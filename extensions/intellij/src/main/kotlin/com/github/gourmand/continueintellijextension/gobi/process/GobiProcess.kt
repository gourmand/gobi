package com.github.gourmand.gobiintellijextension.`gobi`.process

import java.io.InputStream
import java.io.OutputStream

interface GobiProcess {

    val input: InputStream
    val output: OutputStream

    fun close()

}
