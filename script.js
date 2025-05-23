// in index.html's onAuthStateChanged
if (user) {
    // ... existing code ...
    const myProfileLink = document.getElementById('my-profile-link');
    if (myProfileLink) {
        myProfileLink.href = `profile.html?uid=${user.uid}`;
    }
    // ...
}