package com.github.gourmand.gobiintellijextension.actions

import com.github.gourmand.gobiintellijextension.HighlightedCodePayload
import com.github.gourmand.gobiintellijextension.RangeInFileWithContents
import com.github.gourmand.gobiintellijextension.browser.GobiBrowserService.Companion.getBrowser
import com.github.gourmand.gobiintellijextension.editor.DiffStreamService
import com.github.gourmand.gobiintellijextension.editor.EditorUtils
import com.github.gourmand.gobiintellijextension.services.GobiPluginService
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.PlatformDataKeys
import com.intellij.openapi.components.service
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.Project
import java.io.File

class RestartGobiProcess : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        e.project?.service<GobiPluginService>()?.coreMessenger?.restart()
    }
}

class AcceptDiffAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        acceptHorizontalDiff(e)
        acceptVerticalDiff(e)
    }

    private fun acceptHorizontalDiff(e: AnActionEvent) {
        val gobiPluginService = e.project?.service<GobiPluginService>() ?: return
        gobiPluginService.diffManager?.acceptDiff(null)
    }

    private fun acceptVerticalDiff(e: AnActionEvent) {
        val project = e.project ?: return
        val editor =
            e.getData(PlatformDataKeys.EDITOR) ?: FileEditorManager.getInstance(project).selectedTextEditor ?: return
        val diffStreamService = project.service<DiffStreamService>()
        diffStreamService.accept(editor)
    }
}

class RejectDiffAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        rejectHorizontalDiff(e)
        rejectVerticalDiff(e)
    }

    private fun rejectHorizontalDiff(e: AnActionEvent) {
        e.project?.service<GobiPluginService>()?.diffManager?.rejectDiff(null)
    }

    private fun rejectVerticalDiff(e: AnActionEvent) {
        val project = e.project ?: return
        val editor =
            e.getData(PlatformDataKeys.EDITOR) ?: FileEditorManager.getInstance(project).selectedTextEditor ?: return
        val diffStreamService = project.service<DiffStreamService>()
        diffStreamService.reject(editor)
    }
}

class FocusGobiInputWithoutClearAction : GobiToolbarAction() {
    override fun toolbarActionPerformed(project: Project) {
        FocusActionUtil.sendHighlightedCodeWithMessageToWebview(project, "focusGobiInputWithoutClear")
    }
}

class FocusGobiInputAction : GobiToolbarAction() {
    override fun toolbarActionPerformed(project: Project) {
        FocusActionUtil.sendHighlightedCodeWithMessageToWebview(project, "focusGobiInputWithNewSession")
    }
}

class NewGobiSessionAction : GobiToolbarAction() {
    override fun toolbarActionPerformed(project: Project) {
        project.getBrowser()?.sendToWebview("focusGobiInputWithNewSession")
    }
}

class ViewHistoryAction : GobiToolbarAction() {
    override fun toolbarActionPerformed(project: Project) {
        project.getBrowser()?.sendToWebview("navigateTo", mapOf("path" to "/history", "toggle" to true))
    }
}

class OpenConfigAction : GobiToolbarAction() {
    override fun toolbarActionPerformed(project: Project)  {
        project.getBrowser()?.sendToWebview("navigateTo", mapOf("path" to "/config", "toggle" to true))
    }
}

class OpenLogsAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val logFile = File(System.getProperty("user.home") + "/.gobi/logs/core.log")
        if (logFile.exists()) {
            val virtualFile = com.intellij.openapi.vfs.LocalFileSystem.getInstance().findFileByIoFile(logFile)
            if (virtualFile != null) {
                FileEditorManager.getInstance(project).openFile(virtualFile, true)
            }
        }
    }
}

object FocusActionUtil {
    fun sendHighlightedCodeWithMessageToWebview(project: Project?, messageType: String) {
        val browser = project?.getBrowser()
            ?: return
        browser.sendToWebview(messageType)
        browser.focusOnInput()
        val rif = EditorUtils.getEditor(project)?.getHighlightedRIF()
            ?: return
        val code = HighlightedCodePayload(RangeInFileWithContents(rif.filepath, rif.range, rif.contents))
        browser.sendToWebview("highlightedCode", code)
    }
}

