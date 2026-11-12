package com.example.movieapptv.domain.model

data class StreamConnection(
    val serverName: String,
    val link: String,
    val type: String,
    val status: String,
    val metadata: Map<String, Any?> = emptyMap(),
)

data class Movie(
    val id: String,
    val titleRaw: String,
    val titleVietnamese: String? = null,
    val description: String,
    val thumbnailLink: String,
    val backgroundLink: String,
    val type: String,
    val year: Int,
    val episodeCount: Int,
    val actors: List<String>,
    val audioTypes: List<String>,
    val genres: List<String>,
    val youtubeTrailerLink: String? = null,
    val franchiseMovieIds: List<String> = emptyList(),
    val streamConnections: List<StreamConnection>,
    val createdAt: String,
    val lastUpdated: String,
) {
    fun liveStreams(): List<StreamConnection> =
        streamConnections.filter { it.status == "live" }.distinctBy { it.link }
}
