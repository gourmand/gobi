package com.github.gourmand.gobiintellijextension.activities

import com.intellij.openapi.fileEditor.FileEditorManagerListener
import com.github.gourmand.gobiintellijextension.auth.AuthListener
import com.github.gourmand.gobiintellijextension.auth.GobiAuthService
import com.github.gourmand.gobiintellijextension.auth.ControlPlaneSessionInfo
import com.github.gourmand.gobiintellijextension.browser.GobiBrowserService.Companion.getBrowser
import com.github.gourmand.gobiintellijextension.constants.getGobiGlobalPath
import com.github.gourmand.gobiintellijextension.`gobi`.*
import com.github.gourmand.gobiintellijextension.listeners.GobiPluginSelectionListener
import com.github.gourmand.gobiintellijextension.services.GobiExtensionSettings
import com.github.gourmand.gobiintellijextension.services.GobiPluginService
import com.github.gourmand.gobiintellijextension.services.SettingsListener
import com.github.gourmand.gobiintellijextension.utils.toUriOrNull
import com.intellij.openapi.actionSystem.KeyboardShortcut
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.application.ApplicationNamesInfo
import com.intellij.openapi.editor.EditorFactory
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.keymap.KeymapManager
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.StartupActivity
import com.intellij.openapi.util.io.StreamUtil
import com.intellij.openapi.vfs.LocalFileSystem
import kotlinx.coroutines.*
import java.io.*
import java.nio.charset.StandardCharsets
import java.nio.file.Paths
import javax.swing.*
import com.intellij.openapi.components.service
import com.intellij.openapi.module.Module
import com.intellij.openapi.module.ModuleManager
import com.intellij.openapi.project.ModuleListener
import com.intellij.openapi.roots.ModuleRootManager
import com.intellij.openapi.vfs.VirtualFileManager
import com.intellij.openapi.vfs.newvfs.BulkFileListener
import com.intellij.openapi.vfs.newvfs.events.VFileEvent
import com.intellij.openapi.vfs.newvfs.events.VFileDeleteEvent
import com.intellij.openapi.vfs.newvfs.events.VFileContentChangeEvent
import com.intellij.openapi.vfs.newvfs.events.VFileCreateEvent
import com.intellij.ide.ui.LafManagerListener
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.util.Function

fun showTutorial(project: Project) {
    val tutorialFileName = getTutorialFileName()

    GobiPluginStartupActivity::class.java.getClassLoader().getResourceAsStream(tutorialFileName)
        .use { `is` ->
            if (`is` == null) {
                throw IOException("Resource not found: $tutorialFileName")
            }
            var content = StreamUtil.readText(`is`, StandardCharsets.UTF_8)

            // All jetbrains will use J instead of L
            content = content.replace("[Cmd + L]", "[Cmd + J]")
            content = content.replace("[Cmd + Shift + L]", "[Cmd + Shift + J]")

            if (!System.getProperty("os.name").lowercase().contains("mac")) {
                content = content.replace("[Cmd + J]", "[Ctrl + J]")
                content = content.replace("[Cmd + Shift + J]", "[Ctrl + Shift + J]")
                content = content.replace("[Cmd + I]", "[Ctrl + I]")
                content = content.replace("⌘", "⌃")
            }
            val filepath = Paths.get(getGobiGlobalPath(), tutorialFileName).toString()
            File(filepath).writeText(content)
            val virtualFile = LocalFileSystem.getInstance().findFileByPath(filepath)

            ApplicationManager.getApplication().invokeLater {
                if (virtualFile != null) {
                    FileEditorManager.getInstance(project).openFile(virtualFile, true)
                }
            }
        }
}

private fun getTutorialFileName(): String {
    val appName = ApplicationNamesInfo.getInstance().fullProductName.lowercase()
    return when {
        appName.contains("intellij") -> "gobi_tutorial.java"
        appName.contains("pycharm") -> "gobi_tutorial.py"
        appName.contains("webstorm") -> "gobi_tutorial.ts"
        else -> "gobi_tutorial.py" // Default to Python tutorial
    }
}

class GobiPluginStartupActivity : StartupActivity, DumbAware {

    override fun runActivity(project: Project) {
        removeShortcutFromAction(getPlatformSpecificKeyStroke("J"))
        removeShortcutFromAction(getPlatformSpecificKeyStroke("shift J"))
        removeShortcutFromAction(getPlatformSpecificKeyStroke("I"))
        initializePlugin(project)
    }

    private fun getPlatformSpecificKeyStroke(key: String): String {
        val osName = System.getProperty("os.name").toLowerCase()
        val modifier = if (osName.contains("mac")) "meta" else "control"
        return "$modifier $key"
    }

    private fun removeShortcutFromAction(shortcut: String) {
        val keymap = KeymapManager.getInstance().activeKeymap
        val keyStroke = KeyStroke.getKeyStroke(shortcut)
        val actionIds = keymap.getActionIds(keyStroke)

        // If Gobi has been re-assigned to another key, don't remove the shortcut
        if (!actionIds.any { it.startsWith("gobi") }) {
            return
        }

        for (actionId in actionIds) {
            if (actionId.startsWith("gobi")) {
                gobi
            }
            val shortcuts = keymap.getShortcuts(actionId)
            for (shortcut in shortcuts) {
                if (shortcut is KeyboardShortcut && shortcut.firstKeyStroke == keyStroke) {
                    keymap.removeShortcut(actionId, shortcut)
                }
            }
        }
    }

    private fun initializePlugin(project: Project) {
        val coroutineScope = CoroutineScope(Dispatchers.IO)
        val gobiPluginService = project.service<GobiPluginService>()

        coroutineScope.launch {
            val settings = service<GobiExtensionSettings>()
            if (!settings.gobiState.shownWelcomeDialog) {
                settings.gobiState.shownWelcomeDialog = true
                // Open tutorial file
                showTutorial(project)
            }

            settings.addRemoteSyncJob()

            val ideProtocolClient = IdeProtocolClient(
                gobiPluginService,
                coroutineScope,
                project
            )

            val diffManager = DiffManager(project)

            gobiPluginService.diffManager = diffManager
            gobiPluginService.ideProtocolClient = ideProtocolClient

            // Listen to changes to settings so the core can reload remote configuration
            val connection = ApplicationManager.getApplication().messageBus.connect()
            connection.subscribe(SettingsListener.TOPIC, object : SettingsListener {
                override fun settingsUpdated(settings: GobiExtensionSettings.GobiState) {
                    gobiPluginService.coreMessenger?.request(
                        "config/ideSettingsUpdate", mapOf(
                            "remoteConfigServerUrl" to settings.remoteConfigServerUrl,
                            "remoteConfigSyncPeriod" to settings.remoteConfigSyncPeriod,
                            "userToken" to settings.userToken,
                        ), null
                    ) { _ -> }
                }
            })

            // Handle file changes and deletions - reindex
            connection.subscribe(VirtualFileManager.VFS_CHANGES, object : BulkFileListener {
                override fun after(events: List<VFileEvent>) {
                    // Collect all relevant URIs for deletions
                    val deletedURIs = events.filterIsInstance<VFileDeleteEvent>()
                        .mapNotNull { event -> event.file.toUriOrNull() }

                    // Send "files/deleted" message if there are any deletions
                    if (deletedURIs.isNotEmpty()) {
                        val data = mapOf("uris" to deletedURIs)
                        gobiPluginService.coreMessenger?.request("files/deleted", data, null) { _ -> }
                    }

                    // Collect all relevant URIs for content changes
                    val changedURIs = events.filterIsInstance<VFileContentChangeEvent>()
                        .mapNotNull { event -> event.file.toUriOrNull() }

                    // Notify core of content changes
                    if (changedURIs.isNotEmpty()) {
                        val data = mapOf("uris" to changedURIs)
                        gobiPluginService.coreMessenger?.request("files/changed", data, null) { _ -> }
                    }

                    events.filterIsInstance<VFileCreateEvent>()
                        .mapNotNull { event -> event.file?.toUriOrNull() }
                        .takeIf { it.isNotEmpty() }?.let {
                            val data = mapOf("uris" to it)
                            gobiPluginService.coreMessenger?.request("files/created", data, null) { _ -> }
                        }

                    // TODO: Missing handling of copying files, renaming files, etc.
                }
            })

            // Handle workspace directories changes
            connection.subscribe(
                ModuleListener.TOPIC,
                object : ModuleListener {
                    override fun modulesAdded(project: Project, modules: MutableList<out Module>) {

                        val allModulePaths = ModuleManager.getInstance(project).modules
                            .flatMap { module -> ModuleRootManager.getInstance(module).contentRoots.mapNotNull { it.toUriOrNull() } }

                        val topLevelModulePaths = allModulePaths
                            .filter { modulePath -> allModulePaths.none { it != modulePath && modulePath.startsWith(it) } }

                        gobiPluginService.workspacePaths = topLevelModulePaths.toTypedArray();
                    }

                    override fun moduleRemoved(project: Project, module: Module) {
                        val removedPaths = ModuleRootManager.getInstance(module).contentRoots.mapNotNull { it.toUriOrNull() } ;
                        gobiPluginService.workspacePaths = gobiPluginService.workspacePaths?.toList()?.filter { path -> removedPaths.none {removedPath -> path == removedPath }}?.toTypedArray();
                    }

                    override fun modulesRenamed(
                        project: Project,
                        modules: MutableList<out Module>,
                        oldNameProvider: Function<in Module, String>
                    ) {
                        val allModulePaths = ModuleManager.getInstance(project).modules
                            .flatMap { module -> ModuleRootManager.getInstance(module).contentRoots.mapNotNull { it.toUriOrNull() } }

                        val topLevelModulePaths = allModulePaths
                            .filter { modulePath -> allModulePaths.none { it != modulePath && modulePath.startsWith(it) } }

                        gobiPluginService.workspacePaths = topLevelModulePaths.toTypedArray()
                    }
                }
            )

            connection.subscribe(FileEditorManagerListener.FILE_EDITOR_MANAGER, object : FileEditorManagerListener {
                override fun fileClosed(source: FileEditorManager, file: VirtualFile) {
                    file.toUriOrNull()?.let { uri ->
                        val data = mapOf("uris" to listOf(uri))
                        gobiPluginService.coreMessenger?.request("files/closed", data, null) { _ -> }
                    }
                }

                override fun fileOpened(source: FileEditorManager, file: VirtualFile) {
                    file.toUriOrNull()?.let { uri ->
                        val data = mapOf("uris" to listOf(uri))
                        gobiPluginService.coreMessenger?.request("files/opened", data, null) { _ -> }
                    }
                }
            })


            // Listen for theme changes
            connection.subscribe(LafManagerListener.TOPIC, LafManagerListener {
                val colors = GetTheme().getTheme()
                project.getBrowser()?.sendToWebview("jetbrains/setColors", colors)
            })

            // Listen for clicking settings button to start the auth flow
            val authService = service<GobiAuthService>()
            val initialSessionInfo = authService.loadControlPlaneSessionInfo()

            if (initialSessionInfo != null) {
                val data = mapOf(
                    "sessionInfo" to initialSessionInfo
                )
                gobiPluginService.coreMessenger?.request("didChangeControlPlaneSessionInfo", data, null) { _ -> }
            }

            connection.subscribe(AuthListener.TOPIC, object : AuthListener {
                override fun startAuthFlow() {
                    authService.startAuthFlow(project, false)
                }

                override fun handleUpdatedSessionInfo(sessionInfo: ControlPlaneSessionInfo?) {
                    val data = mapOf(
                        "sessionInfo" to sessionInfo
                    )
                    gobiPluginService.coreMessenger?.request(
                        "didChangeControlPlaneSessionInfo",
                        data,
                        null
                    ) { _ -> }
                }
            })

            val listener =
                GobiPluginSelectionListener(
                    coroutineScope,
                )

            // Reload the WebView
            gobiPluginService?.let { pluginService ->
                val allModulePaths = ModuleManager.getInstance(project).modules
                    .flatMap { module -> ModuleRootManager.getInstance(module).contentRoots.mapNotNull { it.toUriOrNull() } }

                val topLevelModulePaths = allModulePaths
                    .filter { modulePath -> allModulePaths.none { it != modulePath && modulePath.startsWith(it) } }

                pluginService.workspacePaths = topLevelModulePaths.toTypedArray()
            }

            EditorFactory.getInstance().eventMulticaster.addSelectionListener(
                listener,
                project.service<GobiPluginDisposable>()
            )

            val coreMessengerManager = CoreMessengerManager(project, ideProtocolClient, coroutineScope)
            gobiPluginService.coreMessengerManager = coreMessengerManager
        }
    }
}