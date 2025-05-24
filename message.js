// js/message.js (Specific logic for Message page - Direct Messaging)
import { auth, db } from './config.js'; // Make sure config.js exports auth and db
import { showDebugMessage, generateAvatar } from './auth.js'; // Import utility functions

const messageLoginPrompt = document.getElementById('message-login-prompt');
const messageInterface = document.getElementById('message-interface');
const openLoginModalBtn = document.getElementById('open-login-modal');

const conversationsContainer = document.getElementById('conversations-container');
const recipientNameElement = document.getElementById('recipient-name');
const messagesContainer = document.getElementById('messages-container');
const messageTextInput = document.getElementById('message-text-input');
const sendMessageBtn = document.getElementById('send-message-btn');

let currentChatRecipientId = null;
let currentChatThreadId = null;

// --- UI Display Logic based on Auth State ---
auth.onAuthStateChanged(user => {
    if (user) {
        if (messageLoginPrompt) messageLoginPrompt.style.display = 'none';
        if (messageInterface) messageInterface.style.display = 'flex'; // Use flex to layout conversations and active chat
        loadConversations(user.uid);

        // Check if a recipientId is passed from profile.html
        const urlParams = new URLSearchParams(window.location.search);
        const recipientIdFromUrl = urlParams.get('recipientId');
        if (recipientIdFromUrl && recipientIdFromUrl !== user.uid) {
            startOrLoadConversation(user.uid, recipientIdFromUrl);
        }
    } else {
        if (messageLoginPrompt) messageLoginPrompt.style.display = 'block';
        if (messageInterface) messageInterface.style.display = 'none';
        if (conversationsContainer) conversationsContainer.innerHTML = '<p style="text-align: center; color: #666; font-style: italic;">Please log in to view conversations.</p>';
    }
});

if (openLoginModalBtn) {
    openLoginModalBtn.addEventListener('click', () => {
        const authModal = document.getElementById('auth-modal');
        if (authModal) {
            authModal.style.display = 'flex'; // Show login modal
        }
    });
}


// --- Load Conversations List ---
async function loadConversations(currentUserId) {
    if (conversationsContainer) {
        conversationsContainer.innerHTML = '<p style="text-align: center; color: #666; font-style: italic;">Loading conversations...</p>';
    } else {
        console.warn('conversationsContainer not found.');
        return;
    }


    // A conversation could be identified by a combination of two user IDs (e.g., sorted string "UID1_UID2")
    // Or by having the current user's ID in a 'participants' array in a 'threads' collection.
    // For simplicity, let's assume 'threads' collection with a 'participants' array.

    db.collection('messageThreads')
        .where('participants', 'array-contains', currentUserId)
        .orderBy('lastMessageAt', 'desc') // Show most recent conversations first
        .onSnapshot(async (snapshot) => {
            conversationsContainer.innerHTML = '';
            if (snapshot.empty) {
                conversationsContainer.innerHTML = '<p style="text-align: center; color: #666; font-style: italic;">No conversations yet.</p>';
                return;
            }

            // Store promises for fetching user names to run them in parallel
            const conversationPromises = snapshot.docs.map(async doc => {
                const thread = doc.data();
                const threadId = doc.id;
                const otherParticipantId = thread.participants.find(id => id !== currentUserId);

                if (otherParticipantId) {
                    // Fetch other participant's name
                    const otherUserDoc = await db.collection('users').doc(otherParticipantId).get();
                    const otherUserName = otherUserDoc.exists ? (otherUserDoc.data().displayName || otherUserDoc.data().email) : 'Unknown User';

                    return { thread, threadId, otherParticipantId, otherUserName };
                }
                return null;
            });

            // Resolve all promises
            const conversations = (await Promise.all(conversationPromises)).filter(Boolean); // Filter out nulls

            conversations.forEach(({ thread, threadId, otherParticipantId, otherUserName }) => {
                const conversationItem = document.createElement('div');
                conversationItem.classList.add('conversation-item');
                conversationItem.dataset.threadId = threadId;
                conversationItem.dataset.recipientId = otherParticipantId;
                conversationItem.innerHTML = `
                    ${generateAvatar(otherUserName)}
                    <div>
                        <strong>${otherUserName}</strong>
                        <small>${thread.lastMessageText ? thread.lastMessageText.substring(0, 30) + '...' : ''}</small>
                    </div>
                `;
                conversationItem.addEventListener('click', () => {
                    startOrLoadConversation(currentUserId, otherParticipantId, threadId);
                });
                conversationsContainer.appendChild(conversationItem);
            });
        }, (error) => {
            console.error('Error loading conversations:', error);
            showDebugMessage(`Error loading conversations: ${error.message}`, 'error');
        });
}

// --- Start or Load a Specific Conversation ---
async function startOrLoadConversation(currentUserId, recipientId, existingThreadId = null) {
    currentChatRecipientId = recipientId;
    currentChatThreadId = existingThreadId;

    // Get recipient's display name
    const recipientDoc = await db.collection('users').doc(recipientId).get();
    const recipientName = recipientDoc.exists ? (recipientDoc.data().displayName || recipientDoc.data().email) : 'Unknown User';
    if (recipientNameElement) {
        recipientNameElement.textContent = `Conversation with ${recipientName}`;
    }


    // If no existing threadId, find or create one
    if (!currentChatThreadId) {
        // Query for thread where participants are [current, recipient]
        const query1 = await db.collection('messageThreads')
            .where('participants', '==', [currentUserId, recipientId])
            .get();
        // Query for thread where participants are [recipient, current]
        const query2 = await db.collection('messageThreads')
            .where('participants', '==', [recipientId, currentUserId])
            .get();

        let threadDoc = null;
        if (!query1.empty) {
            threadDoc = query1.docs[0];
        } else if (!query2.empty) {
            threadDoc = query2.docs[0];
        }

        if (threadDoc) {
            currentChatThreadId = threadDoc.id;
        } else {
            // Create a new thread if no existing one is found
            try {
                const newThreadRef = await db.collection('messageThreads').add({
                    participants: [currentUserId, recipientId],
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastMessageText: ''
                });
                currentChatThreadId = newThreadRef.id;
                showDebugMessage('New conversation started!', 'success');
            } catch (error) {
                console.error('Error creating new thread:', error);
                showDebugMessage(`Error starting new conversation: ${error.message}`, 'error');
                return;
            }
        }
    }

    // Load messages for the current thread
    if (currentChatThreadId) {
        loadMessagesForThread(currentChatThreadId);
    }


    // Visually mark the active conversation in the list
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.threadId === currentChatThreadId) {
            item.classList.add('active');
        }
    });
}

// --- Load Messages for a Specific Thread ---
function loadMessagesForThread(threadId) {
    if (!messagesContainer) {
        console.warn('messagesContainer not found.');
        return;
    }

    db.collection('messageThreads').doc(threadId).collection('messages')
        .orderBy('createdAt', 'asc')
        .onSnapshot((snapshot) => {
            messagesContainer.innerHTML = ''; // Clear existing messages
            if (snapshot.empty) {
                messagesContainer.innerHTML = '<p style="text-align: center; color: #666; font-style: italic;">No messages in this conversation.</p>';
            } else {
                snapshot.forEach(doc => {
                    const msg = doc.data();
                    const messageElement = document.createElement('div');
                    messageElement.classList.add('message-item');
                    if (auth.currentUser && msg.senderId === auth.currentUser.uid) {
                        messageElement.classList.add('my-message'); // For styling current user's messages
                    } else {
                        messageElement.classList.add('other-message');
                    }
                    messageElement.innerHTML = `
                        <div class="message-bubble">
                            <strong>${msg.senderName}</strong>
                            <p>${msg.messageText}</p>
                            <small>${msg.createdAt ? new Date(msg.createdAt.toDate()).toLocaleString() : 'N/A'}</small>
                        </div>
                    `;
                    messagesContainer.appendChild(messageElement);
                });
                messagesContainer.scrollTop = messagesContainer.scrollHeight; // Scroll to bottom
            }
        }, (error) => {
            console.error('Error loading messages:', error);
            showDebugMessage(`Error loading messages: ${error.message}`, 'error');
        });
}

// --- Send Message ---
if (sendMessageBtn) {
    sendMessageBtn.addEventListener('click', async () => {
        const messageText = messageTextInput.value.trim();
        const user = auth.currentUser;

        if (!user || !currentChatThreadId || !messageText) {
            showDebugMessage('Cannot send message. Please select a conversation and type a message.', 'warning');
            return;
        }

        try {
            await db.collection('messageThreads').doc(currentChatThreadId).collection('messages').add({
                senderId: user.uid,
                senderName: user.displayName || user.email,
                messageText: messageText,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Update last message in the thread document
            await db.collection('messageThreads').doc(currentChatThreadId).update({
                lastMessageText: messageText,
                lastMessageAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            messageTextInput.value = ''; // Clear input
            showDebugMessage('Message sent!', 'success');
        } catch (error) {
            console.error('Error sending message:', error.message);
            showDebugMessage(`Error sending message: ${error.message}`, 'error');
        }
    });
}