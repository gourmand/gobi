package com.github.gourmand.gobiintellijextension.`gobi`.process

import com.github.gourmand.gobiintellijextension.error.GobiPostHogService
import com.github.gourmand.gobiintellijextension.error.GobiSentryService
import com.github.gourmand.gobiintellijextension.proxy.ProxySettings
import com.github.gourmand.gobiintellijextension.utils.OS
import com.github.gourmand.gobiintellijextension.utils.getGobiBinaryPath
import com.github.gourmand.gobiintellijextension.utils.getOS
import com.intellij.openapi.components.service
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import java.io.File
import java.io.InputStream
import java.io.OutputStream
import java.nio.file.Files
import java.nio.file.Paths
import java.nio.file.attribute.PosixFilePermission

class GobiBinaryProcess(
    private val onUnexpectedExit: () -> Unit
) : GobiProcess {

    private val process = startBinaryProcess()
    override val input: InputStream = process.inputStream
    override val output: OutputStream = process.outputStream

    override fun close() =
        process.destroy()

    private fun startBinaryProcess(): Process {
        val path = getGobiBinaryPath()
        runBlocking(Dispatchers.IO) {
            setPermissions()
        }

        val builder = ProcessBuilder(path)
        builder.environment() += ProxySettings.getSettings().toGobiEnvVars()
        return builder
            .directory(File(path).parentFile)
            .start()
            .apply { onExit().thenRun(onUnexpectedExit).thenRun(::reportErrorTelemetry) }
    }

    private fun reportErrorTelemetry() {
        var err = process.errorStream?.bufferedReader()?.readText()?.trim()
        if (err != null) {
            // There are often "⚡️Done in Xms" messages, and we want everything after the last one
            val delimiter = "⚡ Done in"
            val doneIndex = err.lastIndexOf(delimiter)
            if (doneIndex != -1) {
                err = err.substring(doneIndex + delimiter.length)
            }
        }
        service<GobiSentryService>().reportMessage("Core process exited with output: $err")
        service<GobiPostHogService>().capture("jetbrains_core_exit", mapOf("error" to err))
    }

    private companion object {

        private fun setPermissions() {
            val os = getOS()
            when (os) {
                OS.MAC -> setMacOsPermissions()
                OS.WINDOWS -> {}
                OS.LINUX -> elevatePermissions()
            }
        }

        private fun setMacOsPermissions() {
            ProcessBuilder("xattr", "-dr", "com.apple.quarantine", getGobiBinaryPath()).start().waitFor()
            elevatePermissions()
        }

        // todo: consider setting permissions ahead-of-time during build/packaging, not at runtime
        private fun elevatePermissions() {
            val path = getGobiBinaryPath()
            val permissions = setOf(
                PosixFilePermission.OWNER_READ,
                PosixFilePermission.OWNER_WRITE,
                PosixFilePermission.OWNER_EXECUTE
            )
            Files.setPosixFilePermissions(Paths.get(path), permissions)
        }
    }

}
