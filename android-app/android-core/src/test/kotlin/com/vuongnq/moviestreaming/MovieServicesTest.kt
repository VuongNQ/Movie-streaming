package com.vuongnq.moviestreaming

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class MovieServicesTest {
    @Test
    fun `login should pass with correct username and password`() {
        val service = AuthService(SampleData.users)

        val user = service.login("demo", "123456")

        assertNotNull(user)
    }

    @Test
    fun `login should fail with wrong password`() {
        val service = AuthService(SampleData.users)

        val user = service.login("demo", "wrong")

        assertNull(user)
    }

    @Test
    fun `filter should support category and tag`() {
        val service = MovieCatalogService(SampleData.movies)

        val filtered = service.filter(category = "hanh-dong", tag = "thuyet-minh")

        assertEquals(1, filtered.size)
        assertEquals("m1", filtered.first().id)
    }

    @Test
    fun `load page should support load more`() {
        val service = MovieCatalogService(SampleData.movies)

        val firstPage = service.loadPage(offset = 0, limit = 1)
        val secondPage = service.loadPage(offset = 1, limit = 1)

        assertTrue(firstPage.hasMore)
        assertFalse(secondPage.hasMore)
    }

    @Test
    fun `watch history should be tracked by user`() {
        val history = WatchHistoryService()
        val user = SampleData.users.first().copy(watchedMovieIds = mutableSetOf())

        history.markWatched(user, "m2")

        assertTrue(history.hasWatched(user, "m2"))
    }

    @Test
    fun `update policy should detect force update and highlight`() {
        val updateService = UpdateService(SampleData.versionPolicy)

        assertTrue(updateService.shouldHighlight("1.1.0"))
        assertTrue(updateService.isForceUpdateRequired("1.0.1"))
        assertFalse(updateService.isForceUpdateRequired("1.0.5"))
    }

    @Test
    fun `stream health service should pick fastest reachable stream`() {
        val service = StreamHealthService()

        val best = service.pickFastestStream(
            listOf(
                StreamProbe("slow", responseTimeMs = 400, reachable = true),
                StreamProbe("fast", responseTimeMs = 120, reachable = true),
                StreamProbe("down", responseTimeMs = 10, reachable = false)
            )
        )

        assertEquals("fast", best)
    }
}
