package com.vuongnq.moviestreaming

object SampleData {
    val users = listOf(
        AppUser(username = "demo", password = "123456"),
        AppUser(username = "admin", password = "admin123")
    )

    val movies = listOf(
        Movie(
            id = "m1",
            title = "Biệt đội tốc độ",
            description = "Phim hành động",
            categories = setOf("hanh-dong"),
            tags = setOf("thuyet-minh", "moi-cap-nhat"),
            streamLinks = listOf("https://example.com/movie1.m3u8")
        ),
        Movie(
            id = "m2",
            title = "Mùa yêu đầu",
            description = "Phim tình cảm",
            categories = setOf("tinh-cam"),
            tags = setOf("phu-de"),
            streamLinks = listOf("https://example.com/movie2.m3u8")
        )
    )

    val versionPolicy = VersionPolicy(
        latestVersion = "1.2.0",
        forceVersion = "1.0.5",
        highlightMessage = "Có phiên bản mới ở menu trên cùng"
    )
}
