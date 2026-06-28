package com.example.movieapptv.data.repository

import android.util.Log
import com.example.movieapptv.domain.model.Movie
import com.example.movieapptv.domain.model.StreamConnection
import com.example.movieapptv.domain.repository.MovieRepository
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await

class FirestoreMovieRepository(
    private val firestore: FirebaseFirestore,
) : MovieRepository {

    private val logTag = "FirestoreMovieRepo"

    override suspend fun getMovies(): List<Movie> {
        val snapshot = firestore.collection("movies").get().await()
        val movies = snapshot.documents.mapNotNull { it.toMovie() }
        if (snapshot.isEmpty) {
            Log.w(logTag, "Firestore returned 0 movie documents. Check database target and seeded data.")
        } else if (movies.size != snapshot.size()) {
            Log.w(
                logTag,
                "Mapped ${movies.size} of ${snapshot.size()} movie documents. Some documents are missing required fields.",
            )
        }
        return movies
    }

    override suspend fun getMovieById(movieId: String): Movie? {
        val snapshot = firestore.collection("movies").document(movieId).get().await()
        return snapshot.toMovie()
    }

    private fun DocumentSnapshot.toMovie(): Movie? {
        val id = (getString("id") ?: id).trim()
        val titleRaw = getString("title_raw").orEmpty().trim()
        if (id.isBlank() || titleRaw.isBlank()) {
            Log.w(logTag, "Skipping movie document ${this.id} because id/title_raw is missing.")
            return null
        }

        return Movie(
            id = id,
            titleRaw = titleRaw,
            titleVietnamese = getString("title_vietnamese")?.trim().takeUnless { it.isNullOrEmpty() },
            description = getString("description").orEmpty(),
            thumbnailLink = getString("thumbnail_link").orEmpty(),
            backgroundLink = getString("background_link").orEmpty(),
            type = getString("type").orEmpty(),
            year = getLong("year")?.toInt() ?: 0,
            episodeCount = getLong("episode_count")?.toInt() ?: 1,
            actors = getStringList("actors"),
            audioTypes = getStringList("audio_types"),
            genres = getStringList("genres"),
            youtubeTrailerLink = getString("youtube_trailer_link")?.trim().takeUnless { it.isNullOrEmpty() },
            franchiseMovieIds = getStringList("franchise_movie_ids"),
            streamConnections = getStreamConnections(),
            createdAt = getString("created_at").orEmpty(),
            lastUpdated = getString("last_updated").orEmpty(),
        )
    }

    private fun DocumentSnapshot.getStringList(field: String): List<String> {
        return (get(field) as? List<*>)
            ?.mapNotNull { it as? String }
            ?.map { it.trim() }
            ?.filter { it.isNotBlank() }
            .orEmpty()
    }

    private fun DocumentSnapshot.getStreamConnections(): List<StreamConnection> {
        val rawConnections = get("stream_connections") as? List<*> ?: return emptyList()
        return rawConnections.mapNotNull { item ->
            val map = item as? Map<*, *> ?: return@mapNotNull null
            val serverName = (map["server_name"] as? String)?.trim().orEmpty()
            val link = (map["link"] as? String)?.trim().orEmpty()
            val type = (map["type"] as? String)?.trim().orEmpty()
            val status = (map["status"] as? String)?.trim().orEmpty()
            if (serverName.isBlank() || link.isBlank() || type.isBlank() || status.isBlank()) {
                return@mapNotNull null
            }
            val metadata = (map["metadata"] as? Map<*, *>)
                ?.mapNotNull { (key, value) ->
                    val safeKey = key as? String ?: return@mapNotNull null
                    safeKey to value
                }
                ?.toMap()
                .orEmpty()
            StreamConnection(
                serverName = serverName,
                link = link,
                type = type,
                status = status,
                metadata = metadata,
            )
        }
    }
}
