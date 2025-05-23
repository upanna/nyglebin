// chat.js
// Firebase instances and helper functions (auth, db, debugLog) are globally available.

// DOM Elements for chat.html
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendMessageBtn = document.getElementById('send-message-btn');
const btnLogoutChat = document.getElementById('btn-logout-chat');
const userDisplayChat = document.getElementById('user-display-chat');
const debugMsgChat = document.getElementById('debug-msg-chat');
const myProfileLink = document.getElementById('my-profile-link');
const chatContainer = document.getElementById('chat-container'); // To hide/show

// Logout
btnLogoutChat.addEventListener('click', () => {
    auth.signOut().then(() => {
        window.location.href = 'index.html'; // Redirect to home after logout
    }).catch(error => {
        debugLog('Logout error: ' + error.message, 'debug-msg-chat');
        console.error('Logout error:', error);
    });
});

// Ensure the page only loads for authenticated users
auth.onAuthStateChanged(user => {
    if (user) {
        userDisplayChat.textContent = user.displayName || user.email;
        btnLogoutChat.style.display = 'inline-block';
        myProfileLink.href = `profile.html?uid=${user.uid}`;
        chatContainer.style.display = 'block'; // Show chat if logged in
        loadChatMessages();
    } else {
        // If not logged in, hide chat and show a message
        chatContainer.style.display = 'none'; // Hide the chat UI
        debugMsgChat.style.display = 'block';
        debugMsgChat.textContent = 'Please log in to join the chatroom.';
        // Redirect to index.html after a short delay if not logged in
        setTimeout(() => {
            if (!auth.currentUser) { // Double check in case user logged in during timeout
                window.location.href = 'index.html';
            }
        }, 3000); // Redirect after 3 seconds
    }
});

sendMessageBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault(); // Prevent default form submission behavior if inside a form
        sendMessage();
    }
});

async function sendMessage() {
    const user = auth.currentUser;
    if (!user) {
        alert('You must be logged in to send messages.');
        debugLog('Attempted to send message without login.', 'debug-msg-chat');
        return;
    }

    const messageText = messageInput.value.trim();
    if (messageText === '') return;

    sendMessageBtn.disabled = true;

    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        // Fetch user data from Firestore for senderName and senderPhoto
        let userDisplayName = user.displayName || user.email.split('@')[0];
        let userPhotoURL = user.photoURL || 'https://i.pravatar.cc/48?u=' + user.uid; // Default pravatar

        if (userDoc.exists) {
            const userData = userDoc.data();
            userDisplayName = userData.displayName || userDisplayName;
            userPhotoURL = userData.photoURL || userPhotoURL;
        }

        await db.collection('messages').add({
            text: messageText,
            senderId: user.uid,
            senderName: userDisplayName,
            senderPhoto: userPhotoURL,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        messageInput.value = '';
    } catch (error) {
        alert('Error sending message: ' + error.message);
        debugLog('Error sending message: ' + error.message, 'debug-msg-chat');
        console.error('Error sending message:', error);
    } finally {
        sendMessageBtn.disabled = false;
    }
}

function loadChatMessages() {
    // Clear previous listener to prevent multiple listeners if called multiple times
    if (window.chatUnsubscribe) {
        window.chatUnsubscribe();
    }

    messagesContainer.innerHTML = '<p style="text-align:center; color:#666; font-style: italic;">Loading messages...</p>';
    
    // Listen for new messages
    window.chatUnsubscribe = db.collection('messages').orderBy('createdAt', 'asc').limitToLast(50).onSnapshot({ // Limit to last 50 messages
        next: (snapshot) => {
            messagesContainer.innerHTML = ''; // Clear previous messages
            if (snapshot.empty) {
                messagesContainer.innerHTML = '<p style="text-align:center; color:#666;">No messages yet. Start the conversation!</p>';
                return;
            }
            snapshot.forEach(doc => {
                const message = doc.data();
                renderMessage(message);
            });
            // Auto-scroll to the bottom for new messages
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            debugLog(`Loaded ${snapshot.size} chat messages.`, 'debug-msg-chat');
        },
        error: (err) => {
            messagesContainer.innerHTML = '<p style="text-align:center; color:red;">Failed to load messages.</p>';
            debugLog('Error loading messages: ' + err.message, 'debug-msg-chat');
            console.error('Error loading messages:', err);
        }
    });
}

function renderMessage(message) {
    const currentUser = auth.currentUser;
    const messageEl = document.createElement('div');
    messageEl.className = 'message ' + (currentUser && message.senderId === currentUser.uid ? 'mine' : 'other');

    const senderInfoEl = document.createElement('div');
    senderInfoEl.className = 'sender';

    const senderImg = document.createElement('img');
    senderImg.src = message.senderPhoto || 'https://i.pravatar.cc/30?u=' + message.senderId; // Small avatar for chat
    senderImg.alt = message.senderName + ' profile photo';
    
    const senderNameSpan = document.createElement('span');
    senderNameSpan.textContent = message.senderName || 'Anonymous';
    
    senderInfoEl.appendChild(senderImg);
    senderInfoEl.appendChild(senderNameSpan);

    const messageTextEl = document.createElement('div');
    messageTextEl.textContent = message.text;

    messageEl.appendChild(senderInfoEl);
    messageEl.appendChild(messageTextEl);
    messagesContainer.appendChild(messageEl);
}