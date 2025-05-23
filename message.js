// message.js

// Firebase SDK global objects (already imported in config.js)
// const auth = firebase.auth();
// const db = firebase.firestore();

// UI Elements for Private Messages
const chatWindow = document.getElementById('chat-window');
const privateMessagesDiv = document.getElementById('private-messages');
const privateMessageInput = document.getElementById('private-message-input');
const sendPrivateMessageBtn = document.getElementById('send-private-message-btn');
const currentChatUserNameEl = document.getElementById('current-chat-user-name');
const contactListDiv = document.getElementById('contact-list');

let currentChatUserId = null; // Stores the UID of the user currently being chatted with
let unsubscribeFromMessages = null; // To unsubscribe from previous chat listeners

// --- Debugging Utility (Redefine if not in app.js or ensure app.js is loaded first) ---
// If app.js is loaded before message.js and defines debugLog, you don't need this.
// Otherwise, include this simple version for message.js errors:
function debugLog(message, type = 'debug-msg-private') {
    const debugElement = document.getElementById('debug-log'); // Assuming this exists on index.html or message.html
    if (debugElement) {
        debugElement.textContent = message;
        debugElement.className = type;
        console.log(`DEBUG (${type}): ${message}`);
    } else {
        console.log(`DEBUG (${type}): ${message}`);
    }
}

// Function to fetch user profile (used for contact list display)
async function fetchUserProfile(uid) {
    try {
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists) {
            return userDoc.data();
        }
        return null;
    } catch (error) {
        debugLog(`Error fetching user profile ${uid}: ${error.message}`, 'debug-msg-error');
        console.error('Error fetching user profile:', error);
        return null;
    }
}

// Function to display contact list
async function fetchUsersForContacts() {
    if (!contactListDiv) return;

    db.collection('users').orderBy('userName').onSnapshot(snapshot => {
        contactListDiv.innerHTML = '';
        const currentUser = auth.currentUser;
        if (!currentUser) {
            contactListDiv.innerHTML = '<p style="text-align:center; color: var(--text-light); margin-top:20px;">Login to see contacts.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const user = { id: doc.id, ...doc.data() };
            // Don't show current user in contact list
            if (user.uid === currentUser.uid) return;

            const contactItemEl = document.createElement('div');
            contactItemEl.className = 'contact-item';
            if (user.uid === currentChatUserId) {
                contactItemEl.classList.add('active'); // Highlight active chat
            }

            contactItemEl.innerHTML = `
                <img src="${user.photoURL || 'https://i.pravatar.cc/40?u=' + user.uid}" alt="Profile Photo">
                <span>${user.userName || 'Anonymous'}</span>
            `;
            contactItemEl.addEventListener('click', () => {
                loadPrivateChat(user.uid, user.userName || 'Anonymous');
                // Remove active class from all and add to current
                document.querySelectorAll('.contact-item').forEach(item => item.classList.remove('active'));
                contactItemEl.classList.add('active');
            });
            contactListDiv.appendChild(contactItemEl);
        });
        debugLog('User contacts fetched and displayed.', 'debug-msg-private');
    }, error => {
        debugLog('Error fetching contacts: ' + error.message, 'debug-msg-error');
        console.error('Error fetching contacts:', error);
        contactListDiv.innerHTML = `<p style="text-align:center; color: var(--delete-color); margin-top:20px;">Error loading contacts: ${error.message}</p>`;
    });
}

// Function to render a single private message with edit/delete options
function renderPrivateMessage(message, currentUserUid, currentChattingWithUid) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${message.senderUid === currentUserUid ? 'mine' : 'other'}`;
    messageEl.id = `private-msg-${message.id}`;

    const senderInfo = document.createElement('div');
    senderInfo.className = 'sender';
    const senderImg = document.createElement('img');
    senderImg.src = message.senderPhoto || 'https://i.pravatar.cc/30?u=' + (message.senderUid || message.senderName);
    senderImg.alt = 'Profile Photo';
    const senderName = document.createElement('span');
    senderName.textContent = message.senderName || 'Anonymous';
    senderInfo.appendChild(senderImg);
    senderInfo.appendChild(senderName);
    messageEl.appendChild(senderInfo);

    const messageTextEl = document.createElement('p');
    messageTextEl.textContent = message.text;
    messageEl.appendChild(messageTextEl);

    // Edit/Delete buttons (only for the sender of this message)
    if (message.senderUid === currentUserUid) {
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'edit-message-btn';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => {
            const newText = prompt('Edit your message:', message.text);
            if (newText !== null && newText.trim() !== message.text.trim()) {
                const chatId = [currentUserUid, currentChattingWithUid].sort().join('_');
                db.collection('chats').doc(chatId).collection('messages').doc(message.id).update({
                    text: newText.trim(),
                    edited: true, // Optional: add an 'edited' flag
                    timestamp: firebase.firestore.FieldValue.serverTimestamp() // Update timestamp on edit
                }).then(() => {
                    debugLog('Private message updated successfully!', 'debug-msg-private-success');
                }).catch(error => {
                    alert('Error updating private message: ' + error.message);
                    debugLog('Private message update error: ' + error.message, 'debug-msg-error');
                    console.error('Error updating private message:', error);
                });
            }
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-message-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to delete this message?')) {
                const chatId = [currentUserUid, currentChattingWithUid].sort().join('_');
                db.collection('chats').doc(chatId).collection('messages').doc(message.id).delete().then(() => {
                    debugLog('Private message deleted successfully!', 'debug-msg-private-success');
                }).catch(error => {
                    alert('Error deleting private message: ' + error.message);
                    debugLog('Private message deletion error: ' + error.message, 'debug-msg-error');
                    console.error('Error deleting private message:', error);
                });
            }
        });

        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(deleteBtn);
        messageEl.appendChild(actionsDiv);
    }

    privateMessagesDiv.appendChild(messageEl);
    privateMessagesDiv.scrollTop = privateMessagesDiv.scrollHeight;
}


// Function to load private chat messages
async function loadPrivateChat(chatWithUid, chatWithUserName) {
    if (unsubscribeFromMessages) {
        unsubscribeFromMessages(); // Unsubscribe from previous chat listener
    }
    currentChatUserId = chatWithUid; // Set the current chat partner UID
    currentChatUserNameEl.textContent = chatWithUserName;
    chatWindow.style.display = 'flex'; // Show chat window
    privateMessagesDiv.innerHTML = ''; // Clear previous messages

    // Highlight the active contact in the list
    document.querySelectorAll('.contact-item').forEach(item => item.classList.remove('active'));
    const activeContactEl = document.querySelector(`.contact-item span:contains("${chatWithUserName}")`).closest('.contact-item');
    if (activeContactEl) {
        activeContactEl.classList.add('active');
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
        debugLog('User not logged in to view private chat.', 'debug-msg-private-info');
        privateMessagesDiv.innerHTML = '<p style="text-align:center; color: var(--text-light); margin-top:20px;">Please login to chat.</p>';
        return;
    }

    // Create a consistent chat ID by sorting UIDs
    const chatId = [currentUser.uid, chatWithUid].sort().join('_');

    debugLog(`Loading chat with: ${chatWithUserName} (Chat ID: ${chatId})`, 'debug-msg-private');

    // Listen for new messages in the chat subcollection
    unsubscribeFromMessages = db.collection('chats').doc(chatId).collection('messages')
        .orderBy('timestamp')
        .limit(100)
        .onSnapshot(snapshot => {
            privateMessagesDiv.innerHTML = ''; // Clear existing messages
            if (snapshot.empty) {
                privateMessagesDiv.innerHTML = '<p style="text-align:center; color: var(--text-light); margin-top:20px;">Say hello to start the conversation!</p>';
                debugLog('No messages found in this private chat.', 'debug-msg-private-info');
                return;
            }
            snapshot.forEach(doc => {
                const message = { id: doc.id, ...doc.data() }; // Include doc.id
                renderPrivateMessage(message, currentUser.uid, chatWithUid); // Pass current user and chat partner UID
            });
            privateMessagesDiv.scrollTop = privateMessagesDiv.scrollHeight;
        }, error => {
            debugLog('Error listening to private messages: ' + error.message, 'debug-msg-error');
            console.error('Error listening to private messages:', error);
            privateMessagesDiv.innerHTML = `<p style="text-align:center; color: var(--delete-color); margin-top:20px;">Error loading messages: ${error.message}</p>`;
        });
}

// --- Auth State Change Listener for Message Page ---
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('message.html')) {
        auth.onAuthStateChanged(user => {
            if (user) {
                fetchUsersForContacts(); // Load contact list
                debugLog('User logged in for private messages.', 'debug-msg-private');
            } else {
                contactListDiv.innerHTML = '<p style="text-align:center; color: var(--text-light); margin-top:20px;">Please login to view contacts.</p>';
                chatWindow.style.display = 'none';
                debugLog('User logged out from private messages.', 'debug-msg-private-info');
            }
        });

        // Event listener for sending private messages
        sendPrivateMessageBtn.addEventListener('click', async () => {
            const text = privateMessageInput.value.trim();
            const user = auth.currentUser;

            if (text && user && currentChatUserId) {
                try {
                    // Fetch sender's profile for message display
                    const senderDoc = await db.collection('users').doc(user.uid).get();
                    const senderData = senderDoc.data();

                    const senderName = senderData ? senderData.userName : (user.displayName || 'Anonymous');
                    const senderPhoto = senderData ? senderData.photoURL : (user.photoURL || 'https://i.pravatar.cc/30?u=' + user.uid);

                    const chatId = [user.uid, currentChatUserId].sort().join('_');

                    await db.collection('chats').doc(chatId).collection('messages').add({
                        senderUid: user.uid,
                        senderName: senderName,
                        senderPhoto: senderPhoto,
                        receiverUid: currentChatUserId, // Optional, but good for clarity
                        text: text,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    privateMessageInput.value = '';
                } catch (e) {
                    alert('Error sending private message: ' + e.message);
                    debugLog('Send private message error: ' + e.message, 'debug-msg-error');
                    console.error(e);
                }
            } else if (!user) {
                alert('Please login to send messages.');
                debugLog('Attempted to send private message without login.', 'debug-msg-private-info');
            } else if (!currentChatUserId) {
                alert('Please select a contact to chat with.');
                debugLog('No contact selected for private message.', 'debug-msg-private-info');
            }
        });

        // Send private message on Enter key press
        privateMessageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendPrivateMessageBtn.click();
            }
        });
    }
});
