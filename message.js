// message.js
// Firebase instances and helper functions (auth, db, debugLog) are globally available.

const userContactsList = document.getElementById('contact-list');
const chatWindow = document.getElementById('chat-window');
const currentChatUserName = document.getElementById('current-chat-user-name');
const privateMessagesContainer = document.getElementById('private-messages');
const privateMessageInput = document.getElementById('private-message-input');
const sendPrivateMessageBtn = document.getElementById('send-private-message-btn');
const btnLogoutMessage = document.getElementById('btn-logout-message');
const userDisplayMessage = document.getElementById('user-display-message');
const debugMsgMessage = document.getElementById('debug-msg-message');
const myProfileLink = document.getElementById('my-profile-link');

let currentChatPartnerId = null;
let currentChatUnsubscribe = null; // For private chat listener

// Logout
btnLogoutMessage.addEventListener('click', () => {
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    }).catch(error => {
        debugLog('Logout error: ' + error.message, 'debug-msg-message');
        console.error('Logout error:', error);
    });
});

// Ensure the page only loads for authenticated users
auth.onAuthStateChanged(user => {
    if (user) {
        userDisplayMessage.textContent = user.displayName || user.email;
        btnLogoutMessage.style.display = 'inline-block';
        myProfileLink.href = `profile.html?uid=${user.uid}`;
        loadContacts();
    } else {
        chatWindow.style.display = 'none'; // Hide chat window if not logged in
        debugMsgMessage.style.display = 'block';
        debugMsgMessage.textContent = 'Please log in to view your messages.';
        setTimeout(() => {
            if (!auth.currentUser) {
                window.location.href = 'index.html';
            }
        }, 3000);
    }
});

sendPrivateMessageBtn.addEventListener('click', sendPrivateMessage);
privateMessageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !sendPrivateMessageBtn.disabled) {
        e.preventDefault();
        sendPrivateMessage();
    }
});

async function loadContacts() {
    userContactsList.innerHTML = '<p style="text-align: center; color: #666; font-style: italic;">Loading contacts...</p>';
    const currentUser = auth.currentUser;
    if (!currentUser) {
        debugLog('No current user to load contacts.', 'debug-msg-message');
        return;
    }

    db.collection('users').orderBy('displayName', 'asc').onSnapshot({
        next: (snapshot) => {
            userContactsList.innerHTML = '';
            if (snapshot.empty) {
                userContactsList.innerHTML = '<p style="text-align: center; color: #666;">No other members found.</p>';
                return;
            }
            snapshot.forEach(doc => {
                const contactData = doc.data();
                const contactId = doc.id;

                if (contactId === currentUser.uid) { // Don't list self in contacts
                    return;
                }

                const contactItem = document.createElement('div');
                contactItem.className = 'contact-item';
                if (contactId === currentChatPartnerId) {
                    contactItem.classList.add('active'); // Highlight active chat
                }
                contactItem.dataset.userId = contactId;
                contactItem.onclick = () => selectContact(contactId, contactData.displayName, contactData.photoURL);

                const contactImg = document.createElement('img');
                contactImg.src = contactData.photoURL || 'https://i.pravatar.cc/40?u=' + contactId;
                contactImg.alt = contactData.displayName + ' profile photo';

                const contactNameSpan = document.createElement('span');
                contactNameSpan.textContent = contactData.displayName || 'Unknown User';

                contactItem.appendChild(contactImg);
                contactItem.appendChild(contactNameSpan);
                userContactsList.appendChild(contactItem);
            });
            debugLog(snapshot.size - 1 + ' contacts loaded.', 'debug-msg-message');
        },
        error: (err) => {
            userContactsList.innerHTML = '<p style="text-align: center; color: red;">Failed to load contacts.</p>';
            debugLog('Error loading contacts: ' + err.message, 'debug-msg-message');
            console.error('Error loading contacts:', err);
        }
    });
}

function selectContact(userId, userName, userPhoto) {
    if (currentChatUnsubscribe) {
        currentChatUnsubscribe(); // Unsubscribe from previous chat
    }

    currentChatPartnerId = userId;
    currentChatUserName.textContent = `Chat with ${userName}`;
    chatWindow.style.display = 'flex'; // Show chat window
    privateMessageInput.disabled = false;
    sendPrivateMessageBtn.disabled = false;

    // Highlight active contact in list
    document.querySelectorAll('.contact-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.userId === userId) {
            item.classList.add('active');
        }
    });

    loadPrivateMessages(userId, userName, userPhoto);
}

function getChatId(uid1, uid2) {
    // Ensure consistent chat ID regardless of which user initiates
    return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

function loadPrivateMessages(partnerId, partnerName, partnerPhoto) {
    privateMessagesContainer.innerHTML = '<p style="text-align:center; color:#666; font-style: italic;">Loading messages...</p>';
    const currentUser = auth.currentUser;
    const chatId = getChatId(currentUser.uid, partnerId);

    currentChatUnsubscribe = db.collection('chats').doc(chatId).collection('messages')
        .orderBy('createdAt', 'asc').limitToLast(50).onSnapshot({
            next: (snapshot) => {
                privateMessagesContainer.innerHTML = '';
                if (snapshot.empty) {
                    privateMessagesContainer.innerHTML = `<p style="text-align:center; color:#666;">No messages with ${partnerName} yet. Say hello!</p>`;
                }
                snapshot.forEach(doc => {
                    const message = doc.data();
                    renderPrivateMessage(message, currentUser.uid);
                });
                privateMessagesContainer.scrollTop = privateMessagesContainer.scrollHeight;
                debugLog(`Loaded ${snapshot.size} private messages for chat ID: ${chatId}.`, 'debug-msg-message');
            },
            error: (err) => {
                privateMessagesContainer.innerHTML = '<p style="text-align:center; color:red;">Failed to load messages.</p>';
                debugLog('Error loading private messages: ' + err.message, 'debug-msg-message');
                console.error('Error loading private messages:', err);
            }
        });
}

async function sendPrivateMessage() {
    const user = auth.currentUser;
    if (!user || !currentChatPartnerId) {
        alert('Please select a contact to send a message.');
        debugLog('Attempted to send private message without recipient.', 'debug-msg-message');
        return;
    }

    const messageText = privateMessageInput.value.trim();
    if (messageText === '') return;

    sendPrivateMessageBtn.disabled = true;

    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        let userDisplayName = user.displayName || user.email.split('@')[0];
        let userPhotoURL = user.photoURL || 'https://i.pravatar.cc/48?u=' + user.uid;

        if (userDoc.exists) {
            const userData = userDoc.data();
            userDisplayName = userData.displayName || userDisplayName;
            userPhotoURL = userData.photoURL || userPhotoURL;
        }

        const chatId = getChatId(user.uid, currentChatPartnerId);
        await db.collection('chats').doc(chatId).collection('messages').add({
            text: messageText,
            senderId: user.uid,
            senderName: userDisplayName,
            senderPhoto: userPhotoURL,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        privateMessageInput.value = '';
    } catch (error) {
        alert('Error sending message: ' + error.message);
        debugLog('Error sending private message: ' + error.message, 'debug-msg-message');
        console.error('Error sending private message:', error);
    } finally {
        sendPrivateMessageBtn.disabled = false;
    }
}

function renderPrivateMessage(message, currentUserId) {
    const messageEl = document.createElement('div');
    messageEl.className = 'message ' + (message.senderId === currentUserId ? 'mine' : 'other');

    const senderInfoEl = document.createElement('div');
    senderInfoEl.className = 'sender';

    const senderImg = document.createElement('img');
    senderImg.src = message.senderPhoto || 'https://i.pravatar.cc/30?u=' + message.senderId;
    senderImg.alt = message.senderName + ' profile photo';
    
    const senderNameSpan = document.createElement('span');
    senderNameSpan.textContent = message.senderName || 'Anonymous';
    
    senderInfoEl.appendChild(senderImg);
    senderInfoEl.appendChild(senderNameSpan);

    const messageTextEl = document.createElement('div');
    messageTextEl.textContent = message.text;

    messageEl.appendChild(senderInfoEl);
    messageEl.appendChild(messageTextEl);
    privateMessagesContainer.appendChild(messageEl);
}