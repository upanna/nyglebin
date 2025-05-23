// js/chat.js
// This script handles chatroom specific functionalities

// DOM Elements
const chatMessagesContainer = document.getElementById('chat-messages-container');
const chatInputArea = document.getElementById('chat-input-area');
const chatInput = document.getElementById('chat-input');
const sendMessageBtn = document.getElementById('send-message-btn');
const chatLoginPrompt = document.getElementById('chat-login-prompt');

let unsubscribeFromChatMessages = null; // For real-time listener cleanup

// --- Chat Message Display ---
function displayChatMessage(message, messageId) {
    if (!chatMessagesContainer) return;

    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message-item');
    messageElement.setAttribute('data-message-id', messageId);

    const isCurrentUser = auth.currentUser && auth.currentUser.uid === message.senderId;
    if (isCurrentUser) {
        messageElement.classList.add('my-message'); // Style for own messages
    } else {
        messageElement.classList.add('other-message'); // Style for others' messages
    }

    let deleteButtonHtml = '';
    if (isCurrentUser) {
        deleteButtonHtml = `<button class="delete-chat-message-btn" data-message-id="${messageId}">Delete</button>`;
    }

    messageElement.innerHTML = `
        <div class="message-header">
            <img src="${message.senderPhoto || 'images/default-profile.png'}" alt="User Photo" class="chat-user-photo">
            <span class="chat-username">${message.senderName || 'Anonymous'}</span>
            <span class="chat-timestamp">${message.timestamp ? new Date(message.timestamp.toDate()).toLocaleString() : 'Just now'}</span>
            ${deleteButtonHtml}
        </div>
        <p class="message-text">${message.text}</p>
    `;
    chatMessagesContainer.appendChild(messageElement);

    // Scroll to the bottom of the chat
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

// --- Load Chat Messages (Real-time) ---
async function loadChatMessages() {
    if (typeof db === 'undefined' || !chatMessagesContainer) return;

    // Unsubscribe from previous listener if exists
    if (unsubscribeFromChatMessages) {
        unsubscribeFromChatMessages();
    }

    unsubscribeFromChatMessages = db.collection('chatroom') // Use global db
        .orderBy('timestamp', 'asc') // Order by timestamp
        .limit(50) // Limit to latest 50 messages
        .onSnapshot(async (snapshot) => {
            chatMessagesContainer.innerHTML = ''; // Clear existing messages
            if (snapshot.empty) {
                chatMessagesContainer.innerHTML = '<p style="text-align: center; color: #666;">No messages yet. Be the first to say hi!</p>';
                return;
            }

            for (const doc of snapshot.docs) {
                const message = doc.data();
                const messageId = doc.id;
                // Fetch sender info if not directly in message or if photoURL is missing
                if (!message.senderName || !message.senderPhoto) {
                    try {
                        const userDoc = await db.collection('users').doc(message.senderId).get(); // Use global db
                        if (userDoc.exists) {
                            const userData = userDoc.data();
                            message.senderName = userData.name || userData.email || message.senderName;
                            message.senderPhoto = userData.photoURL || 'images/default-profile.png';
                        }
                    } catch (error) {
                        console.error("Error fetching sender info for chat:", error);
                    }
                }
                displayChatMessage(message, messageId);
            }

            // Attach event listeners for delete buttons
            chatMessagesContainer.querySelectorAll('.delete-chat-message-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    const messageIdToDelete = e.target.getAttribute('data-message-id');
                    deleteChatMessage(messageIdToDelete);
                });
            });

        }, (error) => {
            console.error("Error loading chat messages:", error);
            debugLog(`Error loading chat: ${error.message}`, "debug-msg");
        });
}

// --- Send Message ---
if (sendMessageBtn) {
    sendMessageBtn.addEventListener('click', async () => {
        const messageText = chatInput.value.trim();
        if (!messageText) {
            debugLog("Please type a message.", "debug-msg");
            return;
        }
        if (typeof auth === 'undefined' || !auth.currentUser) {
            debugLog("You must be logged in to send messages.", "debug-msg");
            return;
        }

        sendMessageBtn.disabled = true; // Prevent double submission

        try {
            await db.collection('chatroom').add({ // Use global db
                senderId: auth.currentUser.uid,
                senderName: auth.currentUser.displayName || auth.currentUser.email,
                senderPhoto: auth.currentUser.photoURL || '',
                text: messageText,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            chatInput.value = ''; // Clear input
            debugLog("Message sent!", "debug-msg");
        } catch (error) {
            console.error("Error sending message:", error);
            debugLog(`Error sending message: ${error.message}`, "debug-msg");
        } finally {
            sendMessageBtn.disabled = false;
        }
    });
}

// --- Delete Chat Message ---
async function deleteChatMessage(messageId) {
    if (typeof auth === 'undefined' || !auth.currentUser) {
        debugLog("You must be logged in to delete messages.", "debug-msg");
        return;
    }

    const messageRef = db.collection('chatroom').doc(messageId); // Use global db
    try {
        const messageDoc = await messageRef.get();
        if (messageDoc.exists && messageDoc.data().senderId === auth.currentUser.uid) {
            await messageRef.delete();
            debugLog("Message deleted successfully!", "debug-msg");
            // loadChatMessages() will automatically refresh due to onSnapshot listener
        } else {
            debugLog("You don't have permission to delete this message or it does not exist.", "debug-msg");
        }
    } catch (error) {
        console.error("Error deleting message:", error);
        debugLog(`Error deleting message: ${error.message}`, "debug-msg");
    }
}

// Update UI based on auth state for chat page
if (typeof auth !== 'undefined') {
    auth.onAuthStateChanged(user => {
        if (user) {
            if (chatInputArea) chatInputArea.style.display = 'block';
            if (chatLoginPrompt) chatLoginPrompt.style.display = 'none';
            loadChatMessages(); // Load chat messages when user logs in
        } else {
            if (chatInputArea) chatInputArea.style.display = 'none';
            if (chatLoginPrompt) chatLoginPrompt.style.display = 'block';
            if (unsubscribeFromChatMessages) unsubscribeFromChatMessages(); // Clean up listener
            if (chatMessagesContainer) chatMessagesContainer.innerHTML = ''; // Clear messages
        }
    });
}