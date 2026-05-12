package com.vuongnq.moviestreaming

class AuthService(users: List<AppUser>) {
    private val usersByName = users.associateBy { it.username }

    fun login(username: String, password: String): AppUser? {
        val user = usersByName[username] ?: return null
        return user.takeIf { it.password == password }
    }
}

class MovieCatalogService(private val movies: List<Movie>) {
    fun filter(category: String? = null, tag: String? = null): List<Movie> {
        return movies.filter { movie ->
            val categoryMatch = category == null || movie.categories.contains(category)
            val tagMatch = tag == null || movie.tags.contains(tag)
            categoryMatch && tagMatch
        }
    }

    fun loadPage(offset: Int, limit: Int, category: String? = null, tag: String? = null): MoviePage {
        val filtered = filter(category, tag)
        val safeOffset = offset.coerceAtLeast(0)
        if (safeOffset >= filtered.size) {
            return MoviePage(emptyList(), hasMore = false)
        }

        val page = filtered.drop(safeOffset).take(limit)
        return MoviePage(page, hasMore = safeOffset + page.size < filtered.size)
    }
}

class WatchHistoryService {
    fun markWatched(user: AppUser, movieId: String) {
        user.watchedMovieIds.add(movieId)
    }

    fun hasWatched(user: AppUser, movieId: String): Boolean {
        return movieId in user.watchedMovieIds
    }
}

class UpdateService(private val policy: VersionPolicy) {
    fun shouldHighlight(currentVersion: String): Boolean = currentVersion != policy.latestVersion

    fun isForceUpdateRequired(currentVersion: String): Boolean = compareVersion(currentVersion, policy.forceVersion) < 0

    private fun compareVersion(current: String, required: String): Int {
        val a = current.split(".").map { it.toIntOrNull() ?: 0 }
        val b = required.split(".").map { it.toIntOrNull() ?: 0 }
        val max = maxOf(a.size, b.size)
        return (0 until max)
            .map { index -> (a.getOrNull(index) ?: 0).compareTo(b.getOrNull(index) ?: 0) }
            .firstOrNull { it != 0 } ?: 0
    }
}

class StreamHealthService {
    fun pickFastestStream(probes: List<StreamProbe>): String? {
        return probes
            .filter { it.reachable && it.responseTimeMs >= 0 }
            .minByOrNull { it.responseTimeMs }
            ?.link
    }
}
