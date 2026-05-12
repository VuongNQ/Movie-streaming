package com.vuongnq.moviestreaming

interface FirestoreRepository {
    suspend fun loadMovies(): List<Movie>
    suspend fun loadCategories(): List<String>
    suspend fun loadTags(): List<String>
    suspend fun loadVersionPolicy(): VersionPolicy
    suspend fun saveWatchHistory(username: String, watchedMovieIds: Set<String>)
}

class InMemoryFirestoreRepository(
    private val movies: List<Movie>,
    private val categories: List<String>,
    private val tags: List<String>,
    private val policy: VersionPolicy
) : FirestoreRepository {
    override suspend fun loadMovies(): List<Movie> = movies

    override suspend fun loadCategories(): List<String> = categories

    override suspend fun loadTags(): List<String> = tags

    override suspend fun loadVersionPolicy(): VersionPolicy = policy

    override suspend fun saveWatchHistory(username: String, watchedMovieIds: Set<String>) {
        // Stub for Firestore write integration in Android app module.
        require(username.isNotBlank())
        require(watchedMovieIds.isNotEmpty())
    }
}
