// js/live.js
import { db } from './config.js';
import { showDebugMessage, generateAvatar } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
    const onlineUsersList = document.getElementById('online-users-list');
    const eventsList = document.getElementById('events-list');

    // --- Function to fetch and display online users ---
    // This requires users to update their 'last_seen' or 'online_status' in Firestore
    // You would typically use a Firestore listener for real-time updates
    async function fetchOnlineUsers() {
        if (!onlineUsersList) return;
        onlineUsersList.innerHTML = '<p style="text-align: center; color: #666; font-style: italic;">Loading online users...</p>';
        try {
            // Example: Fetch users whose 'lastSeen' is within the last 5 minutes (rough estimate of online)
            const cutoff = new Date(Date.now() - 5 * 60 * 1000);
            const snapshot = await db.collection('users').where('lastSeen', '>', cutoff).orderBy('lastSeen', 'desc').get();

            if (snapshot.empty) {
                onlineUsersList.innerHTML = '<p style="text-align: center; color: #666; font-style: italic;">No users currently online.</p>';
                return;
            }

            onlineUsersList.innerHTML = '<ul></ul>';
            const ul = onlineUsersList.querySelector('ul');
            snapshot.forEach(doc => {
                const user = doc.data();
                const userId = doc.id;
                const li = document.createElement('li');
                li.className = 'member-item'; // Reusing member-item style
                li.innerHTML = `
                    <a href="profile.html?uid=${userId}">
                        ${generateAvatar(user.displayName)}
                        <span>${user.displayName || user.email} <small>(Online)</small></span>
                    </a>
                `;
                ul.appendChild(li);
            });
        } catch (error) {
            console.error('Error fetching online users:', error);
            onlineUsersList.innerHTML = `<p style="color: red; text-align: center;">Error loading online users: ${error.message}</p>`;
        }
    }

    // --- Function to fetch and display live events/streams (placeholder) ---
    // This would likely involve a 'live_events' collection or integration with a streaming service.
    function fetchLiveEvents() {
        if (!eventsList) return;
        eventsList.innerHTML = '<p style="text-align: center; color: #666; font-style: italic;">Loading live events...</p>';
        // Example: db.collection('live_events').where('status', '==', 'active').onSnapshot(...)
        // For now, static content.
        eventsList.innerHTML = `
            <ul>
                <li><p><strong>Upanna Admin:</strong> Community discussion on "Future of AI in Literature" starting soon!</p></li>
                <li><p><strong>UserX:</strong> Live coding session on Firebase coming up at 3 PM.</p></li>
                <li><p style="text-align: center; color: #666; font-style: italic; margin-top: 15px;">More live content will appear here when available.</p></li>
            </ul>
        `;
    }

    // Initial load
    fetchOnlineUsers();
    fetchLiveEvents();

    // Optionally set up real-time listeners for live updates (e.g., every 10-30 seconds)
    // setInterval(fetchOnlineUsers, 30000); // Update online users every 30 seconds
});