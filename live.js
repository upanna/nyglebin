// js/live.js

// Make sure firebase, db, auth are available from config.js
if (typeof firebase === 'undefined' || typeof db === 'undefined' || typeof auth === 'undefined') {
    console.error("Firebase, db, or auth not initialized. Ensure config.js is loaded first.");
}

// Get DOM elements
const announceLiveForm = document.getElementById('announce-live-form');
const liveTopicInput = document.getElementById('live-topic');
const liveDatetimeInput = document.getElementById('live-datetime');
const liveLocationInput = document.getElementById('live-location');
const liveDescriptionInput = document.getElementById('live-description');
const btnAnnounceLive = document.getElementById('btn-announce-live');
const btnCancelAnnouncement = document.getElementById('btn-cancel-announcement');

const liveAnnouncementSection = document.getElementById('live-announcement-form');
const liveControlSection = document.getElementById('live-control');
const liveViewerSection = document.getElementById('live-viewer');
const upcomingLivesList = document.getElementById('upcoming-lives-list');

const rtmpStreamKeyInput = document.getElementById('rtmp-stream-key');
const btnStartStream = document.getElementById('btn-start-stream');
const btnEndStream = document.getElementById('btn-end-stream');
const livePlayerContainer = document.getElementById('live-player-container');
const currentLiveTitle = document.getElementById('current-live-title');
const currentLiveDetails = document.getElementById('current-live-details');

const liveMessagesContainer = document.getElementById('live-messages-container');
const liveCommentInput = document.getElementById('live-comment-input');
const sendLiveCommentBtn = document.getElementById('send-live-comment-btn');

let currentLiveStreamId = null; // To store the ID of the current active live stream
let liveCommentsUnsubscribe = null; // For unsubscribing live comments listener

// --- Firebase Collections References ---
const liveAnnouncementsRef = db.collection('liveAnnouncements');
const liveStreamsRef = db.collection('liveStreams');
const liveCommentsRef = db.collection('liveComments'); // Subcollection of liveStreams

// --- Display / Hide Sections based on user state ---
function updateLiveUI(user) {
    if (user) {
        // User is logged in, show announce form and potentially control
        liveAnnouncementSection.style.display = 'block';
        
        // Check if user is currently streaming
        checkActiveLiveStream(user.uid);

        // Listen for live streams in real-time
        listenForLiveStreams();
        
        // Handle comment input area visibility
        if (sendLiveCommentBtn) {
            sendLiveCommentBtn.style.display = 'block';
            liveCommentInput.style.display = 'block';
        }

    } else {
        // User is logged out, hide forms and controls
        liveAnnouncementSection.style.display = 'none';
        liveControlSection.style.display = 'none';
        liveViewerSection.style.display = 'none'; // Initially hide viewer for logged out, unless a stream is active

        if (sendLiveCommentBtn) {
            sendLiveCommentBtn.style.display = 'none';
            liveCommentInput.style.display = 'none';
        }
        liveMessagesContainer.innerHTML = '<p style="text-align: center; color: #666; font-style: italic;">Log in to join the chat.</p>';
    }
}

// --- Announce Live Stream ---
announceLiveForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const user = auth.currentUser;
    if (!user) {
        alert('Please log in to announce a live stream.');
        return;
    }

    const topic = liveTopicInput.value;
    const datetime = liveDatetimeInput.value;
    const location = liveLocationInput.value;
    const description = liveDescriptionInput.value;

    if (!topic || !datetime) {
        alert('Topic and Date/Time are required.');
        return;
    }

    try {
        await liveAnnouncementsRef.add({
            userId: user.uid,
            userName: user.displayName || user.email,
            userPhoto: user.photoURL || 'images/default-profile.png',
            topic: topic,
            scheduledDateTime: new Date(datetime),
            location: location,
            description: description,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert('Live stream announced successfully!');
        announceLiveForm.reset(); // Clear form
    } catch (error) {
        console.error('Error announcing live stream:', error);
        alert('Failed to announce live stream: ' + error.message);
    }
});

btnCancelAnnouncement.addEventListener('click', () => {
    announceLiveForm.reset();
});

// --- Live Stream Control (Go Live / End Live) ---
btnStartStream.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) {
        alert('Please log in to start a stream.');
        return;
    }

    const streamKey = rtmpStreamKeyInput.value.trim();
    if (!streamKey) {
        alert('Please enter your RTMP Stream Key.');
        return;
    }

    try {
        // Create a new live stream entry in Firestore
        const liveDocRef = await liveStreamsRef.add({
            userId: user.uid,
            userName: user.displayName || user.email,
            userPhoto: user.photoURL || 'images/default-profile.png',
            streamKey: streamKey, // Store the stream key (for owner to see if needed, or for backend validation)
            isLive: true,
            startedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        currentLiveStreamId = liveDocRef.id;

        alert('Live stream started! Use your streaming software (OBS, etc.) with the provided RTMP URL and your Stream Key.');
        btnStartStream.style.display = 'none';
        btnEndStream.style.display = 'block';
        rtmpStreamKeyInput.disabled = true;

        // Optionally, display the live stream player (e.g., using a service like Mux, or a generic RTMP player like video.js/hls.js if you have a streaming server)
        // For a simple demo, we'll just show text. For real implementation, integrate a player.
        livePlayerContainer.innerHTML = `
            <p>Your stream is active. To view, use a player that supports RTMP/HLS from your streaming service.</p>
            <p>For example, if you use Mux, you'd embed their player here.</p>
            <p><strong>Note: This is a placeholder. Real streaming requires a streaming server and player integration.</strong></p>
        `;
        liveViewerSection.style.display = 'block'; // Show viewer section

        // Start listening for comments for this new stream
        listenForLiveComments(currentLiveStreamId);

    } catch (error) {
        console.error('Error starting live stream:', error);
        alert('Failed to start live stream: ' + error.message);
    }
});

btnEndStream.addEventListener('click', async () => {
    if (!currentLiveStreamId) {
        alert('No active stream to end.');
        return;
    }

    if (!confirm('Are you sure you want to end the live stream?')) {
        return;
    }

    try {
        await liveStreamsRef.doc(currentLiveStreamId).update({
            isLive: false,
            endedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Delete all comments for this stream
        const commentsSnapshot = await liveCommentsRef.doc(currentLiveStreamId).collection('comments').get();
        const batch = db.batch();
        commentsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        alert('Live stream ended and comments cleared.');
        btnStartStream.style.display = 'block';
        btnEndStream.style.display = 'none';
        rtmpStreamKeyInput.disabled = false;
        rtmpStreamKeyInput.value = '';
        currentLiveStreamId = null;
        livePlayerContainer.innerHTML = '<p style="text-align: center; color: #666;">Live stream will appear here when active.</p>';
        liveMessagesContainer.innerHTML = '<p style="text-align: center; color: #666; font-style: italic;">No comments yet.</p>';
        if (liveCommentsUnsubscribe) {
            liveCommentsUnsubscribe(); // Stop listening for comments
            liveCommentsUnsubscribe = null;
        }

        liveViewerSection.style.display = 'none'; // Hide viewer section
    } catch (error) {
        console.error('Error ending live stream:', error);
        alert('Failed to end live stream: ' + error.message);
    }
});

// --- Check for active live stream on page load ---
async function checkActiveLiveStream(userId) {
    // Check if the current user has an active stream
    const userActiveStreamSnapshot = await liveStreamsRef
        .where('userId', '==', userId)
        .where('isLive', '==', true)
        .limit(1)
        .get();

    if (!userActiveStreamSnapshot.empty) {
        const doc = userActiveStreamSnapshot.docs[0];
        currentLiveStreamId = doc.id;
        rtmpStreamKeyInput.value = doc.data().streamKey || '';
        rtmpStreamKeyInput.disabled = true;
        btnStartStream.style.display = 'none';
        btnEndStream.style.display = 'block';

        // Display current live stream information for the broadcaster
        liveControlSection.style.display = 'block';
        liveViewerSection.style.display = 'block';
        currentLiveTitle.textContent = `You are Live Now!`;
        currentLiveDetails.textContent = ``; // No public details for broadcaster

        // Start listening for comments for their own active stream
        listenForLiveComments(currentLiveStreamId);

        // Placeholder for actual player (if you integrate one)
        livePlayerContainer.innerHTML = `
            <p>Your stream is active. To view, use a player that supports RTMP/HLS from your streaming service.</p>
            <p>For example, if you use Mux, you'd embed their player here.</p>
            <p><strong>Note: This is a placeholder. Real streaming requires a streaming server and player integration.</strong></p>
        `;
    } else {
        // No active stream by current user
        liveControlSection.style.display = 'block'; // Show control section if logged in
        btnStartStream.style.display = 'block';
        btnEndStream.style.display = 'none';
        rtmpStreamKeyInput.disabled = false;
        liveViewerSection.style.display = 'none'; // Hide viewer for non-broadcasters/no active stream
    }
}

// --- Display Upcoming Live Events and Active Live Streams ---
function listenForLiveStreams() {
    // Listen for announced (upcoming) live streams
    liveAnnouncementsRef
        .orderBy('scheduledDateTime', 'asc')
        .where('scheduledDateTime', '>=', new Date()) // Only upcoming or current
        .onSnapshot(snapshot => {
            upcomingLivesList.innerHTML = ''; // Clear previous list
            if (snapshot.empty) {
                upcomingLivesList.innerHTML = '<p style="text-align: center; color: #666; font-style: italic;">No upcoming live events.</p>';
            } else {
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const liveItem = document.createElement('div');
                    liveItem.className = 'live-event-item card'; // Use card style for announcement
                    liveItem.innerHTML = `
                        <h4>${data.topic}</h4>
                        <p>By: <img src="${data.userPhoto}" class="member-photo" alt="Host Photo"> <strong>${data.userName}</strong></p>
                        <p>When: ${new Date(data.scheduledDateTime.toDate()).toLocaleString()}</p>
                        <p>Where: ${data.location || 'N/A'}</p>
                        <p>${data.description}</p>
                        ${auth.currentUser && auth.currentUser.uid === data.userId && data.isLive === false ? `<button class="edit-live-btn" data-id="${doc.id}">Edit</button>` : ''}
                    `;
                    upcomingLivesList.appendChild(liveItem);
                });
            }
        }, error => {
            console.error("Error fetching upcoming live announcements:", error);
        });

    // Listen for currently active live streams (for all users to view)
    liveStreamsRef
        .where('isLive', '==', true)
        .limit(1) // Assuming only one live stream can be active globally for simplicity
        .onSnapshot(snapshot => {
            if (!snapshot.empty) {
                const liveDoc = snapshot.docs[0];
                const data = liveDoc.data();
                
                // If this is the current user's stream, no need to update viewer, their controls are already set
                if (auth.currentUser && auth.currentUser.uid === data.userId) {
                    // This is the broadcaster, their UI is handled by checkActiveLiveStream
                    return;
                }

                currentLiveStreamId = liveDoc.id; // Set global stream ID
                liveViewerSection.style.display = 'block'; // Show viewer for others
                currentLiveTitle.textContent = `Live Now: ${data.userName}'s Stream`;
                currentLiveDetails.textContent = `Started at: ${new Date(data.startedAt.toDate()).toLocaleTimeString()}`;

                // Replace with actual video player logic for viewers
                livePlayerContainer.innerHTML = `
                    <div class="live-player-placeholder">
                        <p>Watching ${data.userName}'s live stream.</p>
                        <p><strong>Note: A real player for live streaming (e.g., embedding YouTube Live, Twitch, Mux player) would go here.</strong></p>
                        <p>Streaming from ${data.streamKey ? 'their stream key' : 'a private stream.'}</p>
                    </div>
                `;
                
                // Start listening for comments for the active stream
                listenForLiveComments(currentLiveStreamId);

            } else {
                // No active live stream
                if (auth.currentUser && auth.currentUser.uid === currentLiveStreamId) {
                    // If the user was broadcasting, their UI was already updated when they ended the stream
                } else {
                    liveViewerSection.style.display = 'none'; // Hide viewer if no active stream by anyone
                    currentLiveTitle.textContent = `Live Now: No active streams.`;
                    currentLiveDetails.textContent = '';
                    livePlayerContainer.innerHTML = '<p style="text-align: center; color: #666;">Live stream will appear here when active.</p>';
                    liveMessagesContainer.innerHTML = '<p style="text-align: center; color: #666; font-style: italic;">No active stream comments.</p>';
                    if (liveCommentsUnsubscribe) {
                        liveCommentsUnsubscribe(); // Stop listening for comments
                        liveCommentsUnsubscribe = null;
                    }
                }
            }
        }, error => {
            console.error("Error fetching active live streams:", error);
        });
}


// --- Live Comments ---
sendLiveCommentBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user || !currentLiveStreamId) {
        alert('Please log in and wait for an active live stream to comment.');
        return;
    }

    const commentText = liveCommentInput.value.trim();
    if (commentText === '') return;

    try {
        // Comments are stored as a subcollection of the specific live stream document
        await liveCommentsRef.doc(currentLiveStreamId).collection('comments').add({
            userId: user.uid,
            userName: user.displayName || user.email,
            userPhoto: user.photoURL || 'images/default-profile.png',
            comment: commentText,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        liveCommentInput.value = ''; // Clear input
        liveMessagesContainer.scrollTop = liveMessagesContainer.scrollHeight; // Scroll to bottom
    } catch (error) {
        console.error('Error sending live comment:', error);
        alert('Failed to send comment: ' + error.message);
    }
});

function listenForLiveComments(streamId) {
    // Unsubscribe from previous listener if active
    if (liveCommentsUnsubscribe) {
        liveCommentsUnsubscribe();
    }

    liveCommentsUnsubscribe = liveCommentsRef.doc(streamId).collection('comments')
        .orderBy('timestamp', 'asc')
        .onSnapshot(snapshot => {
            liveMessagesContainer.innerHTML = ''; // Clear previous comments
            if (snapshot.empty) {
                liveMessagesContainer.innerHTML = '<p style="text-align: center; color: #666; font-style: italic;">No comments yet.</p>';
            } else {
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const messageElement = document.createElement('div');
                    messageElement.className = 'live-comment-item';
                    messageElement.innerHTML = `
                        <img src="${data.userPhoto}" alt="User Photo" class="comment-user-photo">
                        <span class="comment-username">${data.userName}:</span>
                        <span class="comment-text">${data.comment}</span>
                        <span class="comment-timestamp">${data.timestamp ? new Date(data.timestamp.toDate()).toLocaleTimeString() : '...'}</span>
                    `;
                    liveMessagesContainer.appendChild(messageElement);
                });
                liveMessagesContainer.scrollTop = liveMessagesContainer.scrollHeight; // Scroll to bottom
            }
        }, error => {
            console.error("Error fetching live comments:", error);
        });
}

// --- Initialize UI on Auth State Change (from app.js) ---
auth.onAuthStateChanged(user => {
    updateLiveUI(user);
});

// Initial load of streams (in case auth state is already determined)
if (auth.currentUser) {
    updateLiveUI(auth.currentUser);
} else {
    updateLiveUI(null); // Set initial UI for logged out state
}