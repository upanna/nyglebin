// app.js
// Firebase instances and helper functions (auth, db, debugLog, renderPost) are globally available.

// DOM Elements for index.html
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const userDisplay = document.getElementById('user-display');
const userInfoSection = document.getElementById('user-info');
const userPhoto = document.getElementById('user-photo');
const userName = document.getElementById('user-name');
const postCreateSection = document.getElementById('post-create');
const postText = document.getElementById('post-text');
const btnPost = document.getElementById('btn-post');
const postsSection = document.getElementById('posts');
const myProfileLink = document.getElementById('my-profile-link');

// New: Elements for user profiles list on home page
const allUsersList = document.getElementById('all-users');
const debugMsg = document.getElementById('debug-msg');

// Auth modal elements
const authModal = document.getElementById('auth-modal');
const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
const authSubmit = document.getElementById('auth-submit');
const switchAuth = document.getElementById('switch-auth');
const modalCloseBtn = authModal.querySelector('.modal-close');
const nameFieldContainer = document.getElementById('name-field-container');
const nameInput = document.getElementById('name-input');


let isLoginMode = true; // State for login/signup modal

// Show or hide modal
function showAuthModal(mode) {
  isLoginMode = mode === 'login';
  authTitle.textContent = isLoginMode ? 'Login' : 'Sign Up';
  authSubmit.textContent = isLoginMode ? 'Login' : 'Sign Up';
  switchAuth.textContent = isLoginMode ? "Don't have an account? Sign Up" : "Already have an account? Login";
  nameFieldContainer.style.display = isLoginMode ? 'none' : 'block'; // Show name field only for signup
  nameInput.required = !isLoginMode; // Make name required for signup
  authModal.classList.add('active');
  authForm.reset();
  debugLog('Auth modal opened for ' + mode, 'debug-msg');
}

function hideAuthModal() {
  authModal.classList.remove('active');
  debugLog('Auth modal closed', 'debug-msg');
}

// Handle modal close
modalCloseBtn.addEventListener('click', hideAuthModal);
authModal.addEventListener('click', (e) => {
  if(e.target === authModal) hideAuthModal();
});

// Switch login/signup mode
switchAuth.addEventListener('click', () => {
  showAuthModal(isLoginMode ? 'signup' : 'login');
});

// Open login modal on login button click
btnLogin.addEventListener('click', () => {
  showAuthModal('login');
});

// Logout
btnLogout.addEventListener('click', () => {
  auth.signOut().then(() => {
    debugLog('User logged out successfully.', 'debug-msg');
  }).catch(error => {
    debugLog('Logout error: ' + error.message, 'debug-msg');
    console.error('Logout error:', error);
  });
});

// Authentication form submit
authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = authForm['email-input'].value.trim();
  const password = authForm['password-input'].value.trim();
  const displayName = authForm['name-input'].value.trim();
  authSubmit.disabled = true;

  try {
    let userCredential;
    if (isLoginMode) {
      userCredential = await auth.signInWithEmailAndPassword(email, password);
      debugLog('Login success: ' + userCredential.user.email, 'debug-msg');
    } else {
      userCredential = await auth.createUserWithEmailAndPassword(email, password);
      debugLog('Signup success: ' + userCredential.user.email, 'debug-msg');
      
      if(userCredential.user){
        const defaultPhotoURL = 'https://i.pravatar.cc/150?u=' + userCredential.user.uid;
        await userCredential.user.updateProfile({ 
            displayName: displayName || email.split('@')[0],
            photoURL: defaultPhotoURL
        });
        await db.collection('users').doc(userCredential.user.uid).set({
            displayName: displayName || email.split('@')[0],
            email: email,
            photoURL: defaultPhotoURL,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            bio: "Hello, I'm new here!"
        });
        debugLog('User profile initialized in Firestore.', 'debug-msg');
      }
    }
    hideAuthModal();
  } catch (error) {
    alert(error.message);
    debugLog('Auth error: ' + error.message, 'debug-msg');
    console.error('Auth error:', error);
  }
  authSubmit.disabled = false;
});

// Auth state change listener (global for this page)
auth.onAuthStateChanged(async user => {
  debugLog('Auth state changed: ' + (user ? user.email : 'No user'), 'debug-msg');
  if(user){
    userDisplay.textContent = user.displayName || user.email;
    btnLogin.style.display = 'none';
    btnLogout.style.display = 'inline-block';
    userInfoSection.style.display = 'flex';
    postCreateSection.style.display = 'block';
    myProfileLink.href = `profile.html?uid=${user.uid}`;

    const userDoc = await db.collection('users').doc(user.uid).get();
    if(userDoc.exists){
        const userData = userDoc.data();
        userPhoto.src = userData.photoURL || 'https://i.pravatar.cc/48?u=' + user.uid;
        userName.textContent = userData.displayName || user.email;
    } else {
        userPhoto.src = user.photoURL || 'https://i.pravatar.cc/48?u=' + user.uid;
        userName.textContent = user.displayName || user.email;
    }
  } else {
    userDisplay.textContent = '';
    btnLogin.style.display = 'inline-block';
    btnLogout.style.display = 'none';
    userInfoSection.style.display = 'none';
    postCreateSection.style.display = 'none';
    myProfileLink.href = `profile.html`;
  }
  loadPosts();
  loadAllUsers(); // Load all users when auth state changes
});

// Create a post
btnPost.addEventListener('click', async () => {
  const text = postText.value.trim();

  if(!text){
    alert("Please write something to post.");
    return;
  }
  btnPost.disabled = true;

  try {
    const user = auth.currentUser;
    if(!user){
      alert("You must be logged in to post.");
      btnPost.disabled = false;
      return;
    }

    const userDoc = await db.collection('users').doc(user.uid).get();
    let userDisplayName = user.displayName || user.email.split('@')[0];
    let userProfilePhoto = user.photoURL || 'https://i.pravatar.cc/48?u=' + user.uid;

    if (userDoc.exists) {
        const userData = userDoc.data();
        userDisplayName = userData.displayName || userDisplayName;
        userProfilePhoto = userData.photoURL || userProfilePhoto;
    }

    const postData = {
      uid: user.uid,
      userName: userDisplayName,
      userPhoto: userProfilePhoto,
      text: text,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      likes: 0,
      likedBy: []
    };

    await db.collection('posts').add(postData);

    postText.value = '';
    debugLog('Post created successfully.', 'debug-msg');

  } catch (error) {
    alert('Error posting: ' + error.message);
    debugLog('Post error: ' + error.message, 'debug-msg');
    console.error('Post error:', error);
  } finally {
    btnPost.disabled = false;
  }
});

// Load posts and listen for realtime updates
function loadPosts(){
  postsSection.innerHTML = '<p style="font-style:italic; text-align:center;">Loading posts...</p>';
  db.collection('posts').orderBy('createdAt', 'desc').onSnapshot({
    next: (snapshot) => {
      postsSection.innerHTML = '';
      if(snapshot.empty){
        postsSection.innerHTML = '<p style="text-align:center; color:#666;">No posts yet. Be the first to post!</p>';
        return;
      }
      snapshot.forEach(doc => {
        const post = doc.data();
        post.id = doc.id;
        renderPost(post, postsSection, auth, db);
      });
      debugLog(snapshot.size + ' posts loaded.', 'debug-msg');
    },
    error: (err) => {
      postsSection.innerHTML = '<p style="text-align:center; color:red;">Failed to load posts.</p>';
      debugLog('Error loading posts: ' + err.message, 'debug-msg');
      console.error('Error loading posts:', err);
    }
  });
}

// Function to load all users for the left sidebar
function loadAllUsers() {
    allUsersList.innerHTML = '<p style="text-align: center; color: #666; font-style: italic;">Loading members...</p>';
    db.collection('users').orderBy('displayName', 'asc').onSnapshot({
        next: (snapshot) => {
            allUsersList.innerHTML = ''; // Clear previous list
            if (snapshot.empty) {
                allUsersList.innerHTML = '<p style="text-align: center; color: #666;">No members found.</p>';
                return;
            }
            const currentUser = auth.currentUser;
            snapshot.forEach(doc => {
                const userData = doc.data();
                const userId = doc.id;
                const userItem = document.createElement('div');
                userItem.className = 'user-item';
                userItem.onclick = () => {
                    window.location.href = `profile.html?uid=${userId}`;
                };

                const userImg = document.createElement('img');
                userImg.src = userData.photoURL || 'https://i.pravatar.cc/40?u=' + userId;
                userImg.alt = userData.displayName + ' profile photo';

                const userNameSpan = document.createElement('span');
                userNameSpan.textContent = userData.displayName || 'Unknown User';
                if (currentUser && currentUser.uid === userId) {
                    userNameSpan.classList.add('current-user');
                    userNameSpan.textContent += ' (You)';
                }

                userItem.appendChild(userImg);
                userItem.appendChild(userNameSpan);
                allUsersList.appendChild(userItem);
            });
            debugLog(snapshot.size + ' members loaded.', 'debug-msg');
        },
        error: (err) => {
            allUsersList.innerHTML = '<p style="text-align: center; color: red;">Failed to load members.</p>';
            debugLog('Error loading members: ' + err.message, 'debug-msg');
            console.error('Error loading members:', err);
        }
    });
}