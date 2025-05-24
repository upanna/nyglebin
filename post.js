// js/post.js
import { auth, db } from './config.js';
import { showDebugMessage, generateAvatar } from './auth.js'; // Assuming auth.js exports these

document.addEventListener('DOMContentLoaded', () => {
    const postTitleElement = document.getElementById('post-title');
    const postMetaElement = document.getElementById('post-meta');
    const postContentDisplay = document.getElementById('post-content-display');
    const likePostBtn = document.getElementById('like-post-btn');
    const likeCountSpan = document.getElementById('like-count');
    const dislikePostBtn = document.getElementById('dislike-post-btn');
    const dislikeCountSpan = document.getElementById('dislike-count');
    const postActionsSection = document.getElementById('post-actions');

    const commentsSection = document.getElementById('comments-section');
    const commentsList = document.getElementById('comments-list');
    const commentCountSpan = document.getElementById('comment-count');
    const commentTextInput = document.getElementById('comment-text-input');
    const sendCommentBtn = document.getElementById('send-comment-btn');
    const commentInputArea = document.getElementById('comment-input-area');
    const commentLoginPrompt = document.getElementById('comment-login-prompt');

    let currentPostId = null;

    // Get post ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('id');

    if (!postId) {
        postTitleElement.textContent = 'Post Not Found';
        postMetaElement.textContent = '';
        postContentDisplay.innerHTML = '<p>No post ID provided in the URL.</p>';
        showDebugMessage('No post ID found in URL.', 'error');
        return;
    }

    currentPostId = postId;
    likePostBtn.dataset.postId = postId;
    dislikePostBtn.dataset.postId = postId;

    // Function to fetch and display post details
    async function fetchPostDetails() {
        try {
            const postRef = db.collection('posts').doc(postId);
            const doc = await postRef.get();

            if (!doc.exists) {
                postTitleElement.textContent = 'Post Not Found';
                postMetaElement.textContent = '';
                postContentDisplay.innerHTML = '<p>The requested post does not exist.</p>';
                showDebugMessage('Post not found.', 'error');
                return;
            }

            const post = doc.data();
            postTitleElement.textContent = post.title;
            postMetaElement.innerHTML = `by ${post.authorName || 'Anonymous'} on ${new Date(post.timestamp.toDate()).toLocaleString()}`;
            postContentDisplay.innerHTML = `<p>${post.content.replace(/\n/g, '<br>')}</p>`; // Preserve newlines

            // Update like/dislike counts
            likeCountSpan.textContent = post.likes || 0;
            dislikeCountSpan.textContent = post.dislikes || 0;

            // Show actions and comments sections
            postActionsSection.style.display = 'flex';
            commentsSection.style.display = 'block';

            updateLikeDislikeButtons(); // Update button state based on user's reaction
            fetchComments(); // Fetch comments for this post

        } catch (error) {
            console.error('Error fetching post details:', error);
            postTitleElement.textContent = 'Error Loading Post';
            postMetaElement.textContent = '';
            postContentDisplay.innerHTML = `<p style="color: red;">Failed to load post: ${error.message}</p>`;
            showDebugMessage('Error loading post: ' + error.message, 'error');
        }
    }

    // Function to handle like/dislike
    async function handleReaction(type) {
        const user = auth.currentUser;
        if (!user) {
            showDebugMessage('Please log in to react to posts.', 'warning');
            return;
        }

        const postRef = db.collection('posts').doc(currentPostId);
        const userId = user.uid;

        try {
            await db.runTransaction(async (transaction) => {
                const postDoc = await transaction.get(postRef);
                if (!postDoc.exists) {
                    throw "Document does not exist!";
                }

                const currentLikes = postDoc.data().likes || 0;
                const currentDislikes = postDoc.data().dislikes || 0;
                const usersLiked = postDoc.data().usersLiked || [];
                const usersDisliked = postDoc.data().usersDisliked || [];

                let newLikes = currentLikes;
                let newDislikes = currentDislikes;
                let newUsersLiked = [...usersLiked];
                let newUsersDisliked = [...usersDisliked];

                if (type === 'like') {
                    if (usersLiked.includes(userId)) {
                        // User already liked, so unlike
                        newLikes = Math.max(0, newLikes - 1);
                        newUsersLiked = newUsersLiked.filter(id => id !== userId);
                    } else {
                        // User likes
                        newLikes = newLikes + 1;
                        newUsersLiked.push(userId);
                        // If user previously disliked, remove dislike
                        if (usersDisliked.includes(userId)) {
                            newDislikes = Math.max(0, newDislikes - 1);
                            newUsersDisliked = newUsersDisliked.filter(id => id !== userId);
                        }
                    }
                } else if (type === 'dislike') {
                    if (usersDisliked.includes(userId)) {
                        // User already disliked, so undislike
                        newDislikes = Math.max(0, newDislikes - 1);
                        newUsersDisliked = newUsersDisliked.filter(id => id !== userId);
                    } else {
                        // User dislikes
                        newDislikes = newDislikes + 1;
                        newUsersDisliked.push(userId);
                        // If user previously liked, remove like
                        if (usersLiked.includes(userId)) {
                            newLikes = Math.max(0, newLikes - 1);
                            newUsersLiked = newUsersLiked.filter(id => id !== userId);
                        }
                    }
                }

                transaction.update(postRef, {
                    likes: newLikes,
                    dislikes: newDislikes,
                    usersLiked: newUsersLiked,
                    usersDisliked: newUsersDisliked
                });
            });
            fetchPostDetails(); // Re-fetch to update counts and button states
        } catch (error) {
            console.error('Transaction failed:', error);
            showDebugMessage('Failed to record reaction: ' + error.message, 'error');
        }
    }

    // Function to update like/dislike button appearance
    function updateLikeDislikeButtons() {
        const user = auth.currentUser;
        if (!user) {
            likePostBtn.classList.remove('liked', 'disliked');
            dislikePostBtn.classList.remove('liked', 'disliked');
            return;
        }

        db.collection('posts').doc(currentPostId).get().then(doc => {
            if (doc.exists) {
                const post = doc.data();
                const usersLiked = post.usersLiked || [];
                const usersDisliked = post.usersDisliked || [];

                if (usersLiked.includes(user.uid)) {
                    likePostBtn.classList.add('liked');
                    dislikePostBtn.classList.remove('liked', 'disliked');
                } else if (usersDisliked.includes(user.uid)) {
                    dislikePostBtn.classList.add('disliked');
                    likePostBtn.classList.remove('liked', 'disliked');
                } else {
                    likePostBtn.classList.remove('liked', 'disliked');
                    dislikePostBtn.classList.remove('liked', 'disliked');
                }
            }
        }).catch(error => {
            console.error('Error updating like/dislike buttons:', error);
        });
    }

    // Event listeners for like/dislike buttons
    if (likePostBtn) {
        likePostBtn.addEventListener('click', () => handleReaction('like'));
    }
    if (dislikePostBtn) {
        dislikePostBtn.addEventListener('click', () => handleReaction('dislike'));
    }


    // Function to fetch and display comments
    async function fetchComments() {
        if (!commentsList) return;
        commentsList.innerHTML = '<p style="text-align:center; color:#666; font-style: italic;">Loading comments...</p>';
        try {
            const commentsSnapshot = await db.collection('posts').doc(postId).collection('comments').orderBy('timestamp', 'asc').get();

            if (commentsSnapshot.empty) {
                commentsList.innerHTML = '<p style="text-align:center; color:#666; font-style: italic;">No comments yet.</p>';
                commentCountSpan.textContent = 0;
                return;
            }

            commentsList.innerHTML = ''; // Clear loading message
            commentCountSpan.textContent = commentsSnapshot.size;

            commentsSnapshot.forEach(doc => {
                const comment = doc.data();
                const commentElement = document.createElement('div');
                commentElement.className = 'comment-item';
                commentElement.innerHTML = `
                    <div class="comment-header">
                        ${generateAvatar(comment.authorName)}
                        <strong>${comment.authorName || 'Anonymous'}</strong>
                        <small>${new Date(comment.timestamp.toDate()).toLocaleString()}</small>
                    </div>
                    <p>${comment.content.replace(/\n/g, '<br>')}</p>
                `;
                commentsList.appendChild(commentElement);
            });
        } catch (error) {
            console.error('Error fetching comments:', error);
            commentsList.innerHTML = `<p style="color: red; text-align: center;">Error loading comments: ${error.message}</p>`;
            showDebugMessage('Error loading comments: ' + error.message, 'error');
        }
    }

    // Function to add a new comment
    if (sendCommentBtn) {
        sendCommentBtn.addEventListener('click', async () => {
            const commentContent = commentTextInput.value.trim();
            const user = auth.currentUser;

            if (!user) {
                showDebugMessage('Please log in to add a comment.', 'warning');
                return;
            }
            if (!commentContent) {
                showDebugMessage('Comment cannot be empty!', 'warning');
                return;
            }

            try {
                await db.collection('posts').doc(postId).collection('comments').add({
                    content: commentContent,
                    authorId: user.uid,
                    authorName: user.displayName || user.email,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
                showDebugMessage('Comment added successfully!', 'success');
                commentTextInput.value = ''; // Clear input field
                fetchComments(); // Refresh comments list
            } catch (error) {
                console.error('Error adding comment:', error);
                showDebugMessage('Error adding comment: ' + error.message, 'error');
            }
        });
    }

    // Authentication state change listener for comments section visibility
    auth.onAuthStateChanged(user => {
        if (user) {
            commentInputArea.style.display = 'flex';
            commentLoginPrompt.style.display = 'none';
        } else {
            commentInputArea.style.display = 'none';
            commentLoginPrompt.style.display = 'block';
        }
        updateLikeDislikeButtons(); // Also update button state if user logs in/out
    });


    // Initial fetch when the page loads
    fetchPostDetails();
});