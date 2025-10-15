package com.github.gourmand.gobiintellijextension.actions

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindowManager

/**
 * Extend your action with [GobiToolbarAction] if you need a visible, active toolbar.
 */
abstract class GobiToolbarAction : AnAction() {

    abstract fun toolbarActionPerformed(project: Project)

    final override fun actionPerformed(event: AnActionEvent) {
        val project = event.project
            ?: return
        val tool = ToolWindowManager.getInstance(project).getToolWindow("Gobi")
            ?: return
        tool.activate(null) // un-collapse toolbar
        toolbarActionPerformed(project)
    }

}