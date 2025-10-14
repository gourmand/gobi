package com.github.gourmand.gobiintellijextension.services

import com.github.gourmand.gobiintellijextension.`gobi`.CoreMessenger
import com.github.gourmand.gobiintellijextension.`gobi`.CoreMessengerManager
import com.github.gourmand.gobiintellijextension.`gobi`.DiffManager
import com.github.gourmand.gobiintellijextension.`gobi`.IdeProtocolClient
import com.github.gourmand.gobiintellijextension.listeners.ActiveHandlerManager
import com.github.gourmand.gobiintellijextension.listeners.DocumentChangeTracker
import com.github.gourmand.gobiintellijextension.toolWindow.GobiPluginToolWindowFactory
import com.github.gourmand.gobiintellijextension.utils.uuid
import com.intellij.openapi.Disposable
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.editor.EditorFactory
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancel
import kotlin.properties.Delegates

@Service(Service.Level.PROJECT)
class GobiPluginService(private val project: Project) : Disposable, DumbAware {
    private val coroutineScope = CoroutineScope(Dispatchers.Main)
    var listener: (() -> Unit)? = null
    var ideProtocolClient: IdeProtocolClient? by Delegates.observable(null) { _, _, _ ->
        synchronized(this) { listener?.also { listener = null }?.invoke() }
    }
    var coreMessengerManager: CoreMessengerManager? = null
    val coreMessenger: CoreMessenger?
        get() = coreMessengerManager?.coreMessenger
    var workspacePaths: Array<String>? = null
    var windowId: String = uuid()
    var diffManager: DiffManager? = null

    init {
        // Set up active handler manager and document change tracking
        setupCursorMovementTracking()
    }

    private fun setupCursorMovementTracking() {
        val activeHandlerManager = project.service<ActiveHandlerManager>()
        val documentChangeTracker = project.service<DocumentChangeTracker>()

        // Register listeners with EditorFactory to handle all editors
        // Use Disposer to ensure they get cleaned up when the project is disposed
        val editorFactory = EditorFactory.getInstance()

        editorFactory.eventMulticaster.addSelectionListener(activeHandlerManager, project)
        editorFactory.eventMulticaster.addCaretListener(activeHandlerManager, project)
        editorFactory.eventMulticaster.addDocumentListener(documentChangeTracker, project)
        
        // Also register disposal cleanup
        Disposer.register(project) {
            activeHandlerManager.dispose()
            documentChangeTracker.dispose()
        }
    }

    override fun dispose() {
        coroutineScope.cancel()
        coreMessenger?.coroutineScope?.let {
            it.cancel()
            coreMessenger?.close()
        }
    }

    /**
     * Add a listener for protocolClient initialization.
     * Currently, only one needs to be processed. If there are more than one,
     * we can use an array to add listeners to ensure that the message is processed.
     */
    fun onProtocolClientInitialized(listener: () -> Unit) {
        if (ideProtocolClient == null) {
            synchronized(this) {
                if (ideProtocolClient == null) {
                    this.listener = listener
                } else {
                    listener()
                }
            }
        } else {
            listener()
        }
    }
}