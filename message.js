// message.js
// ... (existing imports and definitions) ...

const chatWindow = document.getElementById('chat-window');
const privateMessagesDiv = document.getElementById('private-messages');
const privateMessageInput = document.getElementById('private-message-input');
const sendPrivateMessageBtn = document.getElementById('send-private-message-btn');
const currentChatUserNameEl = document.getElementById('current-chat-user-name');
const contactListDiv = document.getElementById('contact-list');

let currentChatUserId = null;
let unsubscribeFromMessages = null;

// ... (existing functions like fetchUserProfile, fetchUsers, loadPrivateChat) ...

// New: Function to render a single private message with edit/delete options
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
        actionsDiv.className = 'message-actions'; // Reuse message-actions CSS

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
                    debugLog('Private message updated successfully!', 'debug-msg-private');
                }).catch(error => {
                    alert('Error updating private message: ' + error.message);
                    debugLog('Private message update error: ' + error.message, 'debug-msg-private');
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
                    debugLog('Private message deleted successfully!', 'debug-msg-private');
                }).catch(error => {
                    alert('Error deleting private message: ' + error.message);
                    debugLog('Private message deletion error: ' + error.message, 'debug-msg-private');
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


// Make sure loadPrivateChat calls renderPrivateMessage with the correct parameters
async function loadPrivateChat(chatWithUid, chatWithUserName) {
    if (unsubscribeFromMessages) {
        unsubscribeFromMessages();
    }
    currentChatUserId = chatWithUid; // Keep this for sending new messages
    currentChatUserNameEl.textContent = chatWithUserName;
    chatWindow.style.display = 'flex';
    privateMessagesDiv.innerHTML = '';

    const currentUser = auth.currentUser;
    if (!currentUser) {
        debugLog('User not logged in to view private chat.', 'debug-msg-private');
        return;
    }

    const chatId = [currentUser.uid, chatWithUid].sort().join('_');

    debugLog(`Loading chat with: ${chatWithUserName} (Chat ID: ${chatId})`, 'debug-msg-private');

    unsubscribeFromMessages = db.collection('chats').doc(chatId).collection('messages')
        .orderBy('timestamp')
        .limit(100)
        .onSnapshot(snapshot => {
            privateMessagesDiv.innerHTML = '';
            snapshot.forEach(doc => {
                const message = { id: doc.id, ...doc.data() };
                // Pass both currentUser.uid and the UID of the person we are chatting with
                renderPrivateMessage(message, currentUser.uid, chatWithUid);
            });
            privateMessagesDiv.scrollTop = privateMessagesDiv.scrollHeight;
        }, error => {
            debugLog('Error listening to private messages: ' + error.message, 'debug-msg-private');
            console.error('Error listening to private messages:', error);
        });
}

// ... (rest of your existing message.js code including sendPrivateMessageBtn logic) ...