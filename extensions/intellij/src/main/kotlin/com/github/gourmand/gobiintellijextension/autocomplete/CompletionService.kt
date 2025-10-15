package com.github.gourmand.gobiintellijextension.autocomplete


interface CompletionService {

    suspend fun getAutocomplete(uuid: String, url: String, line: Int, column: Int): String?

    fun acceptAutocomplete(uuid: String?)

}