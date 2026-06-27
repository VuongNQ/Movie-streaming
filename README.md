Project streaming video on TV, with 3 main components:
- android app TV
- app admin to manage movie.
- extension on chromium to read link steam video from webs and update to app admin.

Technical information:
- DB: using Firestore to store: movies, user login, tracking video play per device.
A move info will be stored a collection with unique ID is generate by title_raw and combine with uuid, include infos:
+ id, title_raw (required), title_vietnamese (optional), description, thumbnail link, background link, link embed preview trailer YouTube (options)
+ generated search fields: title_search_keywords and title_vietnamese_search_keywords. These are derived automatically from title_raw and title_vietnamese on create/update, and can be backfilled for existing movies.
+ type of movie: single movie or TV series, TV franchise
+ type of genre: action, crime, document, horror, animate …
+ year of movie
+ number of movie in session or number of movie in franchise; with type franchise, store linked movie ids in franchise_movie_ids
+ tags actor
+ tags dubbing or subtitles
+ a collections link steam of movie include: name server, link with dubbing or subtitles, status of link(dead or live), info of metadata info of link m3u8 or HLS.
User have 3 type: guest, user, admin. Admin dashboard login uses Google OAuth popup, and dashboard access is granted by Firestore role (users/{uid}.role = admin). On each user have playlist base on device. With guest type, not support playlist or tracking movie has play

- App Admin using react, SPA, connect firestore with require login. App admin can control all movies. Using a dashboard for admin with 2 menu: control movie and user. 
- App Admin movie management supports combined search filters for title keywords, genres, and year. Genre multi-select matches any selected genre, while active filter groups still combine with AND.

- App extension using vanilla JS. App extension is using for read link stream on web when a web play video, show link on UI and have action to copy that link.

- App Android using Kotlin and android studio for dev, connect to firestore, prefer for build app for TV