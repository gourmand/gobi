package com.github.gourmand.gobiintellijextension.`gobi`.process

import java.io.InputStream
import java.io.OutputStream
import java.net.Socket

class GobiSocketProcess : GobiProcess {

    private val socket = Socket("127.0.0.1", 3000)
    override val input: InputStream = socket.inputStream
    override val output: OutputStream = socket.outputStream

    override fun close() =
        socket.close()

}
