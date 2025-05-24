// js/postlist.js
import { db } from './config.js';
import { showDebugMessage } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
    const titlesContainer = document.getElementById('titles-container');

    async function fetchAllPostTitles() {
        if (!titlesContainer) return;
        titlesContainer.innerHTML = '<p style="text-align: center; color: #666; font-style: italic;">Loading posts...</p>';
        try {
            const snapshot = await db.collection('posts').orderBy('timestamp', 'desc').get(); // Get all posts
            if (snapshot.empty) {
                titlesContainer.innerHTML = '<p style="text-align: center; color: #666; font-style: italic;">No posts available yet.</p>';
                return;
            }
            titlesContainer.innerHTML = '<ul></ul>';
            const ul = titlesContainer.querySelector('ul');
            snapshot.forEach(doc => {
                const post = doc.data();
                const postId = doc.id;
                const li = document.createElement('li');
                li.className = 'post-list-item'; // Add a class for styling
                li.innerHTML = `
                    <a href="post.html?id=${postId}">
                        <strong>${post.title}</strong>
                        <br>
                        <small>by ${post.authorName || 'Anonymous'} on ${post.timestamp ? new Date(post.timestamp.toDate()).toLocaleString() : 'N/A'}</small>
                    </a>
                `;
                ul.appendChild(li);
            });
        } catch (error) {
            console.error('Error fetching all post titles:', error);
            titlesContainer.innerHTML = `<p style="color: red; text-align: center;">Error loading posts: ${error.message}</p>`;
            showDebugMessage('Error loading all posts: ' + error.message, 'error');
        }
    }

    fetchAllPostTitles(); // Initial fetch when the page loads
});