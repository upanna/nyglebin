// js/profile.js

// Make sure firebase, db, auth, storage are available from config.js
if (typeof firebase === 'undefined' || typeof db === 'undefined' || typeof auth === 'undefined' || typeof storage === 'undefined') {
    console.error("Firebase, db, auth, or storage not initialized. Ensure config.js is loaded first.");
}

const profileNameDisplay = document.getElementById('profile-name');
const profileEmailDisplay = document.getElementById('profile-email');
const profilePhotoDisplay = document.getElementById('profile-photo');
const changePhotoBtn = document.getElementById('change-photo-btn');
const photoUploadInput = document.getElementById('photo-upload-input');

const editProfileFormSection = document.getElementById('edit-profile-form-section');
const editDisplayNameInput = document.getElementById('edit-display-name');
const editEmailInput = document.getElementById('edit-email');
const editPasswordInput = document.getElementById('edit-password');
const saveProfileBtn = document.getElementById('save-profile-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const profileDetailsSection = document.getElementById('profile-details');

const myPostsSection = document.getElementById('my-posts');
const myPostsContainer = document.getElementById('my-posts-container');
const noPostsMsg = document.getElementById('no-posts-msg');

// New: Live Events Section
const myLiveEventsSection = document.getElementById('my-live-events');
const myLiveEventsContainer = document.getElementById('my-live-events-container');
const noLiveEventsMsg = document.getElementById('no-live-events-msg');


let currentUserId = null; // To store the ID of the profile currently being viewed

// --- Initialize Profile Page ---
auth.onAuthStateChanged(user => {
    if (user) {
        currentUserId = user.uid;
        displayUserProfile(user);
        loadMyPosts(user.uid);
        loadMyLiveAnnouncements(user.uid); // New: Load user's live announcements

        // Show edit profile button if it's the current user's profile
        if (window.location.pathname.endsWith('profile.html')) {
            // If it's the current user's profile page
            document.getElementById('edit-profile-btn').style.display = 'block';
            changePhotoBtn.style.display = 'block';
        }

    } else {
        // User is logged out, redirect to home or show login prompt
        window.location.href = 'index.html'; // Redirect to home page
    }
});

// --- Display User Profile Info ---
async function displayUserProfile(user) {
    if (!user) return;

    profileNameDisplay.textContent = user.displayName || 'N/A';
    profileEmailDisplay.textContent = user.email || 'N/A';
    profilePhotoDisplay.src = user.photoURL || 'images/default-profile.png';

    // Populate edit form fields
    editDisplayNameInput.value = user.displayName || '';
    editEmailInput.value = user.email || '';
}

// --- Edit Profile Logic ---
document.getElementById('edit-profile-btn').addEventListener('click', () => {
    profileDetailsSection.style.display = 'none';
    myPostsSection.style.display = 'none';
    myLiveEventsSection.style.display = 'none'; // Hide live events too
    editProfileFormSection.style.display = 'block';
});

cancelEditBtn.addEventListener('click', () => {
    editProfileFormSection.style.display = 'none';
    profileDetailsSection.style.display = 'block';
    myPostsSection.style.display = 'block';
    myLiveEventsSection.style.display = 'block'; // Show live events again
});

saveProfileBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return;

    const newDisplayName = editDisplayNameInput.value;
    const newEmail = editEmailInput.value;
    const newPassword = editPasswordInput.value;

    try {
        // Update display name
        if (newDisplayName && newDisplayName !== user.displayName) {
            await user.updateProfile({ displayName: newDisplayName });
            // Also update in users collection
            await db.collection('users').doc(user.uid).update({ displayName: newDisplayName });
        }

        // Update email
        if (newEmail && newEmail !== user.email) {
            await user.updateEmail(newEmail);
            // Also update in users collection
            await db.collection('users').doc(user.uid).update({ email: newEmail });
        }

        // Update password
        if (newPassword) {
            await user.updatePassword(newPassword);
        }

        alert('Profile updated successfully!');
        displayUserProfile(user); // Refresh UI
        cancelEditBtn.click(); // Go back to profile view
    } catch (error) {
        console.error('Error updating profile:', error);
        alert('Failed to update profile: ' + error.message);
    }
});

// --- Photo Upload Logic ---
changePhotoBtn.addEventListener('click', () => {
    photoUploadInput.click(); // Trigger file input click
});

photoUploadInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const user = auth.currentUser;
    if (!user) {
        alert('Please log in to change photo.');
        return;
    }

    const storageRef = storage.ref();
    const photoRef = storageRef.child(`profile_photos/${user.uid}/${file.name}`);

    try {
        const snapshot = await photoRef.put(file);
        const photoURL = await snapshot.ref.getDownloadURL();

        await user.updateProfile({ photoURL: photoURL });
        // Also update in users collection
        await db.collection('users').doc(user.uid).update({ photoURL: photoURL });

        profilePhotoDisplay.src = photoURL; // Update UI
        alert('Profile photo updated successfully!');
    } catch (error) {
        console.error('Error uploading photo:', error);
        alert('Failed to upload photo: ' + error.message);
    }
});


// --- Load User's Posts ---
async function loadMyPosts(userId) {
    myPostsContainer.innerHTML = '';
    noPostsMsg.style.display = 'none';

    try {
        const snapshot = await db.collection('posts')
            .where('userId', '==', userId)
            .orderBy('timestamp', 'desc')
            .get();

        if (snapshot.empty) {
            noPostsMsg.style.display = 'block';
        } else {
            snapshot.forEach(doc => {
                const post = doc.data();
                const postId = doc.id;
                const postElement = createPostElement(post, postId, true); // true indicates it's owner's post
                myPostsContainer.appendChild(postElement);
            });
        }
    } catch (error) {
        console.error('Error loading user posts:', error);
        myPostsContainer.innerHTML = '<p style="color: red;">Error loading posts.</p>';
    }
}

// --- Create Post Element (reused from app.js but with edit/delete buttons) ---
function createPostElement(post, postId, isOwner = false) {
    const postElement = document.createElement('div');
    postElement.className = 'post-item';
    postElement.dataset.id = postId;

    // Format timestamp
    const timestamp = post.timestamp ? new Date(post.timestamp.toDate()).toLocaleString() : 'Just now';

    let postImageHtml = '';
    // We are excluding images from posts for now based on user's request.
    // if (post.imageUrl) {
    //     postImageHtml = `<img src="${post.imageUrl}" alt="Post Image">`;
    // }

    let ownerActionsHtml = '';
    if (isOwner) {
        ownerActionsHtml = `
            <div class="post-owner-actions">
                <button class="edit-btn" data-id="${postId}">Edit</button>
                <button class="delete-btn" data-id="${postId}">Delete</button>
            </div>
        `;
    }

    postElement.innerHTML = `
        <div class="post-header">
            <img src="${post.userPhoto || 'images/default-profile.png'}" alt="User Photo" class="post-user-photo">
            <span class="post-username">${post.userName}</span>
            <span class="post-timestamp">${timestamp}</span>
            ${ownerActionsHtml}
        </div>
        <div class="post-content">
            <p>${post.text.replace(/\n/g, '<br>')}</p>
            ${postImageHtml}
        </div>
        <div class="post-actions">
            <button class="like-btn" data-id="${postId}">Like <span class="like-count">${post.likes || 0}</span></button>
            </div>
    `;

    // Add event listeners for like, edit, delete (if owner)
    const likeBtn = postElement.querySelector('.like-btn');
    if (likeBtn) {
        likeBtn.addEventListener('click', () => toggleLike(postId, likeBtn));
    }

    if (isOwner) {
        const deleteBtn = postElement.querySelector('.delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => deletePost(postId));
        }
        const editBtn = postElement.querySelector('.edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => editPost(postId, post.text));
        }
    }

    return postElement;
}


// --- Live Announcements (New Section in Profile) ---
async function loadMyLiveAnnouncements(userId) {
    myLiveEventsContainer.innerHTML = '';
    noLiveEventsMsg.style.display = 'none';

    try {
        const snapshot = await db.collection('liveAnnouncements')
            .where('userId', '==', userId)
            .orderBy('scheduledDateTime', 'desc')
            .get();

        if (snapshot.empty) {
            noLiveEventsMsg.style.display = 'block';
        } else {
            snapshot.forEach(doc => {
                const announcement = doc.data();
                const announcementId = doc.id;
                const eventElement = document.createElement('div');
                eventElement.className = 'live-event-profile-item'; // Use a dedicated class for profile display
                
                const scheduledTime = announcement.scheduledDateTime ? new Date(announcement.scheduledDateTime.toDate()).toLocaleString() : 'Not set';

                eventElement.innerHTML = `
                    <h4>${announcement.topic}</h4>
                    <p><strong>Scheduled:</strong> ${scheduledTime}</p>
                    <p><strong>Location:</strong> ${announcement.location || 'N/A'}</p>
                    <p>${announcement.description}</p>
                    <div class="announcement-actions">
                        <button class="edit-announcement-btn" data-id="${announcementId}">Edit</button>
                        <button class="delete-announcement-btn" data-id="${announcementId}">Delete</button>
                    </div>
                `;
                myLiveEventsContainer.appendChild(eventElement);

                // Add event listeners for edit/delete buttons
                eventElement.querySelector('.edit-announcement-btn').addEventListener('click', () => editLiveAnnouncement(announcementId, announcement));
                eventElement.querySelector('.delete-announcement-btn').addEventListener('click', () => deleteLiveAnnouncement(announcementId));
            });
        }
    } catch (error) {
        console.error('Error loading user live announcements:', error);
        myLiveEventsContainer.innerHTML = '<p style="color: red;">Error loading live announcements.</p>';
    }
}

async function editLiveAnnouncement(id, currentData) {
    const newTopic = prompt('Enter new topic:', currentData.topic);
    if (newTopic === null) return; // User cancelled

    const newDateTimeStr = prompt('Enter new date & time (YYYY-MM-DDTHH:MM):', currentData.scheduledDateTime.toDate().toISOString().slice(0, 16));
    if (newDateTimeStr === null) return; // User cancelled
    const newDateTime = new Date(newDateTimeStr);
    if (isNaN(newDateTime.getTime())) {
        alert('Invalid date and time format. Please use YYYY-MM-DDTHH:MM.');
        return;
    }

    const newLocation = prompt('Enter new location:', currentData.location || '');
    if (newLocation === null) return;

    const newDescription = prompt('Enter new description:', currentData.description || '');
    if (newDescription === null) return;

    try {
        await db.collection('liveAnnouncements').doc(id).update({
            topic: newTopic,
            scheduledDateTime: newDateTime,
            location: newLocation,
            description: newDescription
        });
        alert('Live announcement updated successfully!');
        loadMyLiveAnnouncements(auth.currentUser.uid); // Reload list
    } catch (error) {
        console.error('Error updating live announcement:', error);
        alert('Failed to update live announcement: ' + error.message);
    }
}

async function deleteLiveAnnouncement(id) {
    if (!confirm('Are you sure you want to delete this live announcement?')) {
        return;
    }
    try {
        await db.collection('liveAnnouncements').doc(id).delete();
        alert('Live announcement deleted successfully!');
        loadMyLiveAnnouncements(auth.currentUser.uid); // Reload list
    } catch (error) {
        console.error('Error deleting live announcement:', error);
        alert('Failed to delete live announcement: ' + error.message);
    }
}


// --- Edit Post (Stub - You can implement a proper modal/form) ---
function editPost(postId, currentText) {
    const newText = prompt("Edit your post:", currentText);
    if (newText !== null && newText.trim() !== "") {
        db.collection('posts').doc(postId).update({
            text: newText.trim(),
            editedAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            alert('Post updated successfully!');
            loadMyPosts(auth.currentUser.uid); // Reload posts to show changes
        }).catch(error => {
            console.error('Error updating post:', error);
            alert('Failed to update post: ' + error.message);
        });
    }
}

// --- Delete Post ---
function deletePost(postId) {
    if (confirm('Are you sure you want to delete this post?')) {
        db.collection('posts').doc(postId).delete()
            .then(() => {
                alert('Post deleted successfully!');
                loadMyPosts(auth.currentUser.uid); // Reload posts
            })
            .catch(error => {
                console.error('Error deleting post:', error);
                alert('Failed to delete post: ' + error.message);
            });
    }
}

// --- Toggle Like (reused from app.js) ---
async function toggleLike(postId, likeButtonElement) {
    const user = auth.currentUser;
    if (!user) {
        alert('Please log in to like posts.');
        return;
    }

    const postRef = db.collection('posts').doc(postId);
    const likeRef = postRef.collection('likes').doc(user.uid); // Each user has a like doc

    try {
        const likeDoc = await likeRef.get();
        const postDoc = await postRef.get();
        if (!postDoc.exists) return; // Post might have been deleted

        let currentLikes = postDoc.data().likes || 0;

        if (likeDoc.exists) {
            // User already liked, so unlike
            await likeRef.delete();
            currentLikes = Math.max(0, currentLikes - 1); // Ensure likes don't go below 0
            likeButtonElement.classList.remove('liked');
        } else {
            // User has not liked, so like
            await likeRef.set({
                userId: user.uid,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            currentLikes += 1;
            likeButtonElement.classList.add('liked');
        }

        // Update the main post's like count
        await postRef.update({ likes: currentLikes });
        likeButtonElement.querySelector('.like-count').textContent = currentLikes;

    } catch (error) {
        console.error('Error toggling like:', error);
    }
}