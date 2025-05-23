// chat.js
// ... (existing imports and definitions like auth, db, debugLog) ...

const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendMessageBtn = document.getElementById('send-message-btn');
const chatContainer = document.getElementById('chat-container');

// New: Helper function to render a single chat message with edit/delete options
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
                    debugLog('Message updated successfully!', 'debug-msg-chat');
                }).catch(error => {
                    alert('Error updating message: ' + error.message);
                    debugLog('Message update error: ' + error.message, 'debug-msg-chat');
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
                    debugLog('Message deleted successfully!', 'debug-msg-chat');
                }).catch(error => {
                    alert('Error deleting message: ' + error.message);
                    debugLog('Message deletion error: ' + error.message, 'debug-msg-chat');
                    console.error('Error deleting message:', error);
                });
            }
        });

        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(deleteBtn);
        messageEl.appendChild(actionsDiv); // Append actions to the message element
    }

    messagesDiv.appendChild(messageEl);
    messagesDiv.scrollTop = messagesDiv.scrollHeight; // Scroll to bottom
}


auth.onAuthStateChanged(async (user) => {
    if (user) {
        chatContainer.style.display = 'block';
        debugLog('User is logged in to chat.', 'debug-msg-chat');

        // Listen for new messages
        db.collection('messages').orderBy('timestamp').limit(100).onSnapshot(snapshot => {
            messagesDiv.innerHTML = ''; // Clear existing messages
            snapshot.forEach(doc => {
                const message = { id: doc.id, ...doc.data() }; // Include doc.id for update/delete
                renderChatMessage(message, user.uid); // Pass current user's UID
            });
            messagesDiv.scrollTop = messagesDiv.scrollHeight; // Scroll to bottom
        }, error => {
            debugLog('Error listening to messages: ' + error.message, 'debug-msg-chat');
            console.error('Error listening to messages:', error);
        });

    } else {
        chatContainer.style.display = 'none';
        debugLog('User is logged out from chat.', 'debug-msg-chat');
    }
});

sendMessageBtn.addEventListener('click', async () => {
    const text = messageInput.value.trim();
    const user = auth.currentUser;

    if (text && user) {
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            const userData = userDoc.data();
            const userName = userData ? userData.userName : (user.displayName || 'Anonymous');
            const userPhoto = userData ? userData.photoURL : user.photoURL;

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
            debugLog('Send message error: ' + e.message, 'debug-msg-chat');
            console.error(e);
        }
    } else if (!user) {
        alert('Please login to send messages.');
        debugLog('Attempted to send message without login.', 'debug-msg-chat');
    }
});

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessageBtn.click();
    }
});