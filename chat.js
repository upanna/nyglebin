// chat.js

// Firebase SDK global objects (already imported in config.js)
// const auth = firebase.auth();
// const db = firebase.firestore();

// UI Elements for Chat
const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendMessageBtn = document.getElementById('send-message-btn');
const chatContainer = document.getElementById('chat-container');
const clearChatBtn = document.getElementById('clear-chat-btn'); // For admin clear chat

// --- Debugging Utility (Redefine if not in app.js or ensure app.js is loaded first) ---
// If app.js is loaded before chat.js and defines debugLog, you don't need this.
// Otherwise, include this simple version for chat.js errors:
function debugLog(message, type = 'debug-msg-chat') {
    const debugElement = document.getElementById('debug-log'); // Assuming this exists on index.html or chat.html
    if (debugElement) {
        debugElement.textContent = message;
        debugElement.className = type;
        console.log(`DEBUG (${type}): ${message}`);
    } else {
        console.log(`DEBUG (${type}): ${message}`);
    }
}

// Function to check if the current user is an admin
async function checkIfUserIsAdmin(uid) {
    if (!uid) return false;
    try {
        const userDoc = await db.collection('users').doc(uid).get();
        return userDoc.exists && userDoc.data().isAdmin === true;
    } catch (error) {
        debugLog("Error checking admin status: " + error.message, 'debug-msg-error');
        console.error("Error checking admin status:", error);
        return false;
    }
}

// Function to clear all messages (Admin only)
async function clearAllMessages() {
    if (!confirm('Are you sure you want to clear ALL chat messages? This action cannot be undone.')) {
        return;
    }

    debugLog('Attempting to clear all messages...', 'debug-msg-chat');
    try {
        const currentUser = auth.currentUser;
        if (!currentUser || !(await checkIfUserIsAdmin(currentUser.uid))) {
            alert('Permission denied. You must be an administrator to clear the chat.');
            debugLog('Clear chat: Permission denied.', 'debug-msg-chat');
            return;
        }

        const messagesRef = db.collection('messages');
        let query = messagesRef.limit(500); // Limit to avoid large reads/writes at once (Firestore batch write limit)
        let snapshot = await query.get();

        while (snapshot.size > 0) {
            const batch = db.batch();
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            debugLog(`Cleared ${snapshot.size} messages...`, 'debug-msg-chat');
            snapshot = await query.get(); // Get next batch
        }

        debugLog('All messages cleared successfully!', 'debug-msg-chat-success');
    } catch (error) {
        alert('Error clearing messages: ' + error.message);
        debugLog('Clear chat error: ' + error.message, 'debug-msg-error');
        console.error('Error clearing messages:', error);
    }
}

// Helper function to render a single chat message with edit/delete options
function renderChatMessage(message, currentUserUid) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${message.uid === currentUserUid ? 'mine' : 'other'}`;
    messageEl.id = `chat-msg-${message.id}`; // Add ID for easy selection

    // Sender information
    const senderInfo = document.createElement('div');
    senderInfo.className = 'sender';
    const senderImg = document.createElement('img');
    senderImg.src = message.userPhoto || 'https://i.pravatar.cc/30?u=' + (message.uid || message.userName);
    senderImg.alt = 'Profile Photo';
    const senderName = document.createElement('span');
    senderName.textContent = message.userName || 'Anonymous';
    senderInfo.appendChild(senderImg);
    senderInfo.appendChild(senderName);
    messageEl.appendChild(senderInfo);

    // Message text
    const messageTextEl = document.createElement('p');
    messageTextEl.textContent = message.text;
    messageEl.appendChild(messageTextEl);

    // Edit/Delete buttons (only for owner)
    if (message.uid === currentUserUid) {
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'edit-message-btn';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => {
            const newText = prompt('Edit your message:', message.text);
            if (newText !== null && newText.trim() !== message.text.trim()) {
                db.collection('messages').doc(message.id).update({
                    text: newText.trim(),
                    edited: true, // Optional: add an 'edited' flag
                    timestamp: firebase.firestore.FieldValue.serverTimestamp() // Update timestamp on edit
                }).then(() => {
                    debugLog('Message updated successfully!', 'debug-msg-chat-success');
                }).catch(error => {
                    alert('Error updating message: ' + error.message);
                    debugLog('Message update error: ' + error.message, 'debug-msg-error');
                    console.error('Error updating message:', error);
                });
            }
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-message-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to delete this message?')) {
                db.collection('messages').doc(message.id).delete().then(() => {
                    debugLog('Message deleted successfully!', 'debug-msg-chat-success');
                }).catch(error => {
                    alert('Error deleting message: ' + error.message);
                    debugLog('Message deletion error: ' + error.message, 'debug-msg-error');
                    console.error('Error deleting message:', error);
                });
            }
        });

        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(deleteBtn);
        messageEl.appendChild(actionsDiv);
    }

    messagesDiv.appendChild(messageEl);
    messagesDiv.scrollTop = messagesDiv.scrollHeight; // Scroll to bottom
}

// --- Auth State Change Listener for Chat Page ---
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('chat.html')) {
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                chatContainer.style.display = 'block';
                debugLog('User is logged in to chat.', 'debug-msg-chat');

                // Check admin status and show/hide clear chat button
                if (clearChatBtn) {
                    const isAdmin = await checkIfUserIsAdmin(user.uid);
                    clearChatBtn.style.display = isAdmin ? 'block' : 'none';
                    if (isAdmin) {
                        clearChatBtn.addEventListener('click', clearAllMessages);
                    } else {
                        // Remove previous listener if not admin
                        clearChatBtn.removeEventListener('click', clearAllMessages);
                    }
                }

                // Listen for new messages
                db.collection('messages').orderBy('timestamp').limit(100).onSnapshot(snapshot => {
                    messagesDiv.innerHTML = ''; // Clear existing messages
                    if (snapshot.empty) {
                        messagesDiv.innerHTML = '<p style="text-align:center; color: var(--text-light); margin-top:20px;">No messages yet. Start the conversation!</p>';
                        debugLog('No messages found in global chat.', 'debug-msg-chat-info');
                        return;
                    }
                    snapshot.forEach(doc => {
                        const message = { id: doc.id, ...doc.data() }; // Include doc.id for update/delete
                        renderChatMessage(message, user.uid); // Pass current user's UID
                    });
                    messagesDiv.scrollTop = messagesDiv.scrollHeight; // Scroll to bottom
                }, error => {
                    debugLog('Error listening to messages: ' + error.message, 'debug-msg-error');
                    console.error('Error listening to messages:', error);
                    messagesDiv.innerHTML = `<p style="text-align:center; color: var(--delete-color); margin-top:20px;">Error loading messages: ${error.message}</p>`;
                });

            } else {
                chatContainer.style.display = 'none';
                debugLog('User is logged out from chat.', 'debug-msg-chat-info');
                messagesDiv.innerHTML = '<p style="text-align:center; color: var(--text-light); margin-top:20px;">Please login to join the chat.</p>';
                if (clearChatBtn) clearChatBtn.style.display = 'none'; // Hide clear button on logout
            }
        });

        // Event listener for sending messages
        sendMessageBtn.addEventListener('click', async () => {
            const text = messageInput.value.trim();
            const user = auth.currentUser;

            if (text && user) {
                try {
                    // Fetch current user's display name and photo from 'users' collection
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    const userData = userDoc.data();

                    const userName = userData ? userData.userName : (user.displayName || 'Anonymous');
                    const userPhoto = userData ? userData.photoURL : (user.photoURL || 'https://i.pravatar.cc/30?u=' + user.uid);

                    await db.collection('messages').add({
                        uid: user.uid,
                        userName: userName,
                        userPhoto: userPhoto,
                        text: text,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    messageInput.value = '';
                } catch (e) {
                    alert('Error sending message: ' + e.message);
                    debugLog('Send message error: ' + e.message, 'debug-msg-error');
                    console.error(e);
                }
            } else if (!user) {
                alert('Please login to send messages.');
                debugLog('Attempted to send message without login.', 'debug-msg-chat-info');
            }
        });

        // Send message on Enter key press
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessageBtn.click();
            }
        });
    }
});
