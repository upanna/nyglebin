// profile.js
// Import Firebase instances and helper functions from config.js
// The variables (auth, db, debugLog, renderPost) are globally available.

// DOM Elements for profile.html
const profilePhoto = document.getElementById('profile-photo');
const profileName = document.getElementById('profile-name');
const profileBio = document.getElementById('profile-bio');
const postsByUserSection = document.getElementById('user-posts');
const postsByUserNameSpan = document.getElementById('posts-by-user-name');
const editProfileBtn = document.getElementById('edit-profile-btn');
const btnLogoutProfile = document.getElementById('btn-logout-profile');
const userDisplayProfile = document.getElementById('user-display-profile');
const myProfileLink = document.getElementById('my-profile-link');

// Edit Profile Modal Elements
const editProfileModal = document.getElementById('edit-profile-modal');
const editDisplayNameInput = document.getElementById('edit-display-name');
const editBioTextarea = document.getElementById('edit-bio');
// const editPhotoInput = document.getElementById('edit-photo'); // Removed
const saveProfileBtn = document.getElementById('save-profile-btn');
const closeModalBtn = editProfileModal.querySelector('.close-button');
const debugMsgProfile = document.getElementById('debug-msg-profile');


// Logout
btnLogoutProfile.addEventListener('click', () => {
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    }).catch(error => {
        debugLog('Logout error: ' + error.message, 'debug-msg-profile');
        console.error('Logout error:', error);
    });
});

auth.onAuthStateChanged(async user => {
    if (user) {
        userDisplayProfile.textContent = user.displayName || user.email;
        btnLogoutProfile.style.display = 'inline-block';
        myProfileLink.href = `profile.html?uid=${user.uid}`;

        const urlParams = new URLSearchParams(window.location.search);
        const userId = urlParams.get('uid') || user.uid;

        const userDoc = await db.collection('users').doc(userId).get();

        if (userDoc.exists) {
            const userData = userDoc.data();
            // Default pravatar if no photoURL (or if storage not available)
            profilePhoto.src = userData.photoURL || 'https://i.pravatar.cc/150?u=' + userId;
            profileName.textContent = userData.displayName || 'N/A';
            profileBio.textContent = userData.bio || 'No bio yet.';
            postsByUserNameSpan.textContent = userData.displayName || 'User';

            if (userId === user.uid) {
                editProfileBtn.style.display = 'block';
                editProfileBtn.addEventListener('click', () => {
                    editDisplayNameInput.value = userData.displayName || '';
                    editBioTextarea.value = userData.bio || '';
                    editProfileModal.classList.add('active');
                });
            } else {
                editProfileBtn.style.display = 'none';
            }

            loadUserPosts(userId);

        } else {
            profileName.textContent = 'User Not Found';
            profileBio.textContent = 'This user does not exist or has no profile data.';
            postsByUserNameSpan.textContent = 'User';
            postsByUserSection.innerHTML = '<p style="text-align:center; color:#666;">This user does not exist or has no posts.</p>';
            editProfileBtn.style.display = 'none';
        }

    } else {
        debugLog('User not logged in, redirecting to home...', 'debug-msg-profile');
        window.location.href = 'index.html';
    }
});

function loadUserPosts(uid) {
    postsByUserSection.innerHTML = '<h2>Posts by <span id="posts-by-user-name"></span></h2><p style="font-style:italic; text-align:center;">Loading user posts...</p>';
    db.collection('posts').where('uid', '==', uid).orderBy('createdAt', 'desc').onSnapshot({
        next: (snapshot) => {
            const postsContainer = postsByUserSection;
            postsContainer.innerHTML = '<h2>Posts by <span id="posts-by-user-name">' + postsByUserNameSpan.textContent + '</span></h2>';
            if (snapshot.empty) {
                postsContainer.innerHTML += '<p style="text-align:center; color:#666;">No posts yet from this user.</p>';
                return;
            }
            snapshot.forEach(doc => {
                const post = doc.data();
                post.id = doc.id;
                renderPost(post, postsContainer, auth, db);
            });
            debugLog(`Loaded ${snapshot.size} posts for user ${uid}.`, 'debug-msg-profile');
        },
        error: (err) => {
            postsByUserSection.innerHTML = '<p style="text-align:center; color:red;">Failed to load user posts.</p>';
            debugLog('Error loading user posts: ' + err.message, 'debug-msg-profile');
            console.error('Error loading user posts:', err);
        }
    });
}

// Edit Profile Modal Logic
closeModalBtn.addEventListener('click', () => {
    editProfileModal.classList.remove('active');
});

editProfileModal.addEventListener('click', (e) => {
    if (e.target === editProfileModal) {
        editProfileModal.classList.remove('active');
    }
});

saveProfileBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) {
        alert('You must be logged in to edit your profile.');
        return;
    }

    saveProfileBtn.disabled = true;
    const newDisplayName = editDisplayNameInput.value.trim();
    const newBio = editBioTextarea.value.trim();
    // const newPhotoFile = editPhotoInput.files[0]; // Removed

    try {
        // Update auth profile
        await user.updateProfile({
            displayName: newDisplayName || user.displayName
        });

        // Update Firestore profile
        const userDocRef = db.collection('users').doc(user.uid);
        const updates = {
            displayName: newDisplayName || user.displayName,
            bio: newBio
        };

        // No image upload logic here. Profile photo will remain the default pravatar.

        await userDocRef.update(updates);
        debugLog('Profile updated successfully.', 'debug-msg-profile');

        // Re-load profile info on the page
        profileName.textContent = updates.displayName;
        profileBio.textContent = updates.bio;
        // if (updates.photoURL) { profilePhoto.src = updates.photoURL; } // Removed as no photo upload

        editProfileModal.classList.remove('active');
    } catch (error) {
        alert('Failed to update profile: ' + error.message);
        debugLog('Profile update error: ' + error.message, 'debug-msg-profile');
        console.error('Profile update error:', error);
    } finally {
        saveProfileBtn.disabled = false;
    }
});