package com.vuongnq.moviestreaming

data class Movie(
    val id: String,
    val title: String,
    val description: String,
    val categories: Set<String>,
    val tags: Set<String>,
    val streamLinks: List<String>
)

data class AppUser(
    val username: String,
    val password: String,
    val watchedMovieIds: MutableSet<String> = mutableSetOf()
)

data class VersionPolicy(
    val latestVersion: String,
    val forceVersion: String,
    val highlightMessage: String
)

data class MoviePage(
    val movies: List<Movie>,
    val hasMore: Boolean
)

data class StreamProbe(
    val link: String,
    val responseTimeMs: Long,
    val reachable: Boolean
)
