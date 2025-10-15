package com.github.gourmand.gobiintellijextension.utils

import com.intellij.ide.plugins.PluginManager
import com.intellij.openapi.extensions.PluginId
import com.github.gourmand.gobiintellijextension.constants.GobiConstants
import java.nio.file.Path
import java.nio.file.Paths

/**
 * Gets the path to the Gobi plugin directory
 *
 * @return Path to the plugin directory
 * @throws Exception if the plugin is not found
 */
fun getGobiPluginPath(): Path {
    val pluginDescriptor =
        PluginManager.getPlugin(PluginId.getId(GobiConstants.PLUGIN_ID)) ?: throw Exception("Plugin not found")
    return pluginDescriptor.pluginPath
}

/**
 * Gets the path to the Gobi core directory with target platform
 *
 * @return Path to the Gobi core directory with target platform
 * @throws Exception if the plugin is not found
 */
fun getGobiCorePath(): String {
    val pluginPath = getGobiPluginPath()
    val corePath = Paths.get(pluginPath.toString(), "core").toString()
    val target = getOsAndArchTarget()
    return Paths.get(corePath, target).toString()
}

/**
 * Gets the path to the Gobi binary executable
 *
 * @return Path to the Gobi binary executable
 * @throws Exception if the plugin is not found
 */
fun getGobiBinaryPath(): String {
    val targetPath = getGobiCorePath()
    val os = getOS()
    val exeSuffix = if (os == OS.WINDOWS) ".exe" else ""
    return Paths.get(targetPath, "gobi-binary$exeSuffix").toString()
}

/**
 * Gets the path to the Ripgrep executable
 *
 * @return Path to the Ripgrep executable
 * @throws Exception if the plugin is not found
 */
fun getRipgrepPath(): String {
    val targetPath = getGobiCorePath()
    val os = getOS()
    val exeSuffix = if (os == OS.WINDOWS) ".exe" else ""
    return Paths.get(targetPath, "rg$exeSuffix").toString()
}