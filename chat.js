// js/chat.js

import { auth, db } from './config.js';
import { collection, addDoc, getDocs, onSnapshot, orderBy, serverTimestamp } from 'firebase/firestore';

const chatMessagesDiv = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('send-button');

if (sendButton) {
    sendButton.addEventListener('click', sendMessage);
}
if (chatInput) {
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}

async function sendMessage() {
    const messageText = chatInput.value.trim();
    if (messageText) {
        try {
            const user = auth.currentUser;
            if (user) {
                await addDoc(collection(db, 'chatroom'), {
                    userId: user.uid,
                    userName: user.displayName || user.email.split('@')[0],
                    userPhoto: 'images/default-profile.png', // Default icon
                    text: messageText,
                    timestamp: serverTimestamp()
                });
                chatInput.value = '';
            } else {
                alert('You must be logged in to send a message.');
            }
        } catch (error) {
            console.error("Error sending message: ", error);
        }
    }
}

function loadMessages() {
    const chatroomRef = collection(db, 'chatroom');
    const q = orderBy(chatroomRef, 'timestamp', 'asc');

    onSnapshot(q, (snapshot) => {
        chatMessagesDiv.innerHTML = '';
        snapshot.forEach((doc) => {
            const message = doc.data();
            const messageDiv = document.createElement('div');
            messageDiv.className = 'chat-message';
            messageDiv.innerHTML = `
                <img src="images/default-profile.png" alt="User" style="width: 20px; height: 20px; vertical-align: middle; margin-right: 5px;">
                <span><span class="math-inline">\{message\.userName\}\:</span\>
<p\></span>{message.text}</p>
            `;
            chatMessagesDiv.appendChild(messageDiv);
            chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
        });
    });
}

loadMessages();

auth.onAuthStateChanged((user) => {
    const chatSection = document.getElementById('chat-section');
    if (chatSection) {
        chatSection.style.display = user ? 'block' : 'none';
    }
});