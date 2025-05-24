// js/chatroom.js (Specific logic for Chatroom page)
// Make sure Firebase is initialized and auth/db objects are available from firebase_config.js
import { auth, db } from './firebase_config.js'; // <- ဒီနေရာကို ပြင်ဆင်လိုက်ပါပြီ။
import { showDebugMessage, generateAvatar } from './auth.js'; // Import utility functions

// DOM elements
const chatMessagesContainer = document.getElementById('chat-messages-container');
const chatMessageInput = document.getElementById('chat-message-input');
const sendChatBtn = document.getElementById('send-chat-btn');
const chatInputArea = document.getElementById('chat-input-area');
const chatLoginMsg = document.getElementById('chat-login-msg');

// Ensure DOM elements are available before adding listeners or manipulating styles
document.addEventListener('DOMContentLoaded', () => {
    // --- UI Display Logic based on Auth State ---
    auth.onAuthStateChanged(user => {
        if (user) {
            // User is logged in, allow sending messages
            if (chatInputArea) chatInputArea.style.display = 'flex';
            if (chatLoginMsg) chatLoginMsg.style.display = 'none';
        } else {
            // User is logged out, hide message input
            if (chatInputArea) chatInputArea.style.display = 'none';
            if (chatLoginMsg) chatLoginMsg.style.display = 'block';
        }
        loadChatMessages(); // Load messages for everyone regardless of login state
    });

    // --- Load Chat Messages ---
    function loadChatMessages() {
        if (!chatMessagesContainer) {
            console.warn('chatMessagesContainer not found.');
            return;
        }

        db.collection('chatroomMessages')
            .orderBy('createdAt', 'asc')
            .limit(100) // Limit to last 100 messages for performance
            .onSnapshot((snapshot) => {
                chatMessagesContainer.innerHTML = ''; // Clear existing messages
                if (snapshot.empty) {
                    chatMessagesContainer.innerHTML = '<p style="text-align: center; color: #666; font-style: italic;">No messages yet. Be the first to say hi!</p>';
                } else {
                    snapshot.forEach(doc => {
                        const msg = doc.data();
                        const messageElement = document.createElement('div');
                        messageElement.classList.add('chat-message-item');

                        // Optionally add class for my message vs other message for styling
                        if (auth.currentUser && msg.userId === auth.currentUser.uid) {
                            messageElement.classList.add('my-chat-message'); // Add a class for user's own messages
                        } else {
                            messageElement.classList.add('other-chat-message'); // Add a class for other users' messages
                        }

                        messageElement.innerHTML = `
                            <div class="message-header">
                                ${generateAvatar(msg.userName)}
                                <strong>${msg.userName}</strong>
                                <small>${msg.createdAt ? new Date(msg.createdAt.toDate()).toLocaleTimeString() : 'N/A'}</small>
                            </div>
                            <p>${msg.messageText}</p>
                        `;
                        chatMessagesContainer.appendChild(messageElement);
                    });
                    // Scroll to the bottom to see new messages
                    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
                }
            }, (error) => {
                console.error('Error loading chat messages:', error);
                showDebugMessage(`Error loading chat messages: ${error.message}`, 'error');
            });
    }

    // --- Send Chat Message (Login Required) ---
    if (sendChatBtn) {
        sendChatBtn.addEventListener('click', async () => {
            const messageText = chatMessageInput.value.trim();
            const user = auth.currentUser;

            if (!user) {
                showDebugMessage('Please log in to send messages.', 'warning');
                return;
            }
            if (!messageText) {
                showDebugMessage('Message cannot be empty.', 'warning');
                return;
            }

            try {
                await db.collection('chatroomMessages').add({
                    userId: user.uid,
                    userName: user.displayName || user.email,
                    messageText: messageText,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                chatMessageInput.value = ''; // Clear input
                showDebugMessage('Message sent!', 'success');
            } catch (error) {
                console.error('Error sending chat message:', error.message);
                showDebugMessage(`Error sending message: ${error.message}`, 'error');
            }
        });
    }
});