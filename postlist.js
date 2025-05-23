// postlist.js
// Firebase instances and helper functions (auth, db, debugLog) are globally available.

const postTitlesContainer = document.getElementById('titles-container');
const btnLogoutPostlist = document.getElementById('btn-logout-postlist');
const userDisplayPostlist = document.getElementById('user-display-postlist');
const debugMsgPostlist = document.getElementById('debug-msg-postlist');
const myProfileLink = document.getElementById('my-profile-link');


// Logout
btnLogoutPostlist.addEventListener('click', () => {
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    }).catch(error => {
        debugLog('Logout error: ' + error.message, 'debug-msg-postlist');
        console.error('Logout error:', error);
    });
});

// Auth state handling
auth.onAuthStateChanged(user => {
    if (user) {
        userDisplayPostlist.textContent = user.displayName || user.email;
        btnLogoutPostlist.style.display = 'inline-block';
        myProfileLink.href = `profile.html?uid=${user.uid}`;
    } else {
        userDisplayPostlist.textContent = '';
        btnLogoutPostlist.style.display = 'none';
        myProfileLink.href = `profile.html`;
    }
    loadPostTitles();
});

function loadPostTitles() {
    postTitlesContainer.innerHTML = '<p style="text-align:center; color:#666; font-style: italic;">Loading post titles...</p>';
    db.collection('posts').orderBy('createdAt', 'desc').onSnapshot({
        next: (snapshot) => {
            postTitlesContainer.innerHTML = '';
            if (snapshot.empty) {
                postTitlesContainer.innerHTML = '<p style="text-align:center; color:#666;">No posts yet.</p>';
                return;
            }
            const ul = document.createElement('ul');
            snapshot.forEach(doc => {
                const post = doc.data();
                const postId = doc.id;
                const li = document.createElement('li');
                const a = document.createElement('a');
                a.href = `index.html#post-${postId}`; // Link to the specific post on home page
                a.textContent = post.text.substring(0, 100) + (post.text.length > 100 ? '...' : ''); // Show first 100 chars as title

                const meta = document.createElement('div');
                meta.className = 'post-title-meta';
                const date = post.createdAt ? new Date(post.createdAt.toDate()).toLocaleDateString() : 'Unknown Date';
                meta.textContent = `by ${post.userName || 'Anonymous'} on ${date}`;

                li.appendChild(a);
                li.appendChild(meta);
                ul.appendChild(li);
            });
            postTitlesContainer.appendChild(ul);
            debugLog(`Loaded ${snapshot.size} post titles.`, 'debug-msg-postlist');
        },
        error: (err) => {
            postTitlesContainer.innerHTML = '<p style="text-align:center; color:red;">Failed to load post titles.</p>';
            debugLog('Error loading post titles: ' + err.message, 'debug-msg-postlist');
            console.error('Error loading post titles:', err);
        }
    });
}