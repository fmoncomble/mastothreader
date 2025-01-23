import { franc } from 'https://esm.sh/franc@6?bundle';
import { iso6393 } from 'https://esm.sh/iso-639-3@3?bundle';

document.addEventListener('DOMContentLoaded', async function () {
    const instructionsDiv = document.getElementById('instructions');
    const instanceInput = document.getElementById('instance-input');
    const instanceDataList = document.getElementById('inst-list');
    const instanceBtn = document.getElementById('instance-btn');
    const contentContainer = document.getElementById('content-container');
    const fetchBskyCheckbox = document.getElementById('fetch-bsky-checkbox');
    fetchBskyCheckbox.checked = false;
    const bskyResetBtn = document.getElementById('bsky-reset');
    const numberPostsDiv = document.getElementById('number-posts-div');
    const numberPostsCheckbox = document.getElementById('number-posts');
    numberPostsCheckbox.checked = false;
    const inReplyToDiv = document.getElementById('in-reply-to');
    const inReplyToInput = document.getElementById('in-reply-input');
    const replyPreview = document.getElementById('reply-preview');
    const previewDiv = document.getElementById('replied-post-preview');
    const threadLink = document.getElementById('thread-link');
    const postItem = document.getElementById('post-item');
    const languageSelect = document.querySelector('.lang-select');
    const postThreadBtn = document.getElementById('post-thread-btn');
    const spinner = document.getElementById('spinner');
    const counter = document.getElementById('counter');
    const bskyLoadingSpinner = document.getElementById('bsky-loading-dialog');

    const yearSpan = document.querySelector('span#year');
    yearSpan.textContent = new Date().toISOString().split('-')[0];

    const instructionsBtn = document.getElementById('instructions-btn');
    instructionsBtn.addEventListener('click', () => {
        if (instructionsDiv.style.display === 'none') {
            instructionsDiv.style.display = 'flex';
            instructionsBtn.textContent = 'Masquer les instructions';
        } else {
            instructionsDiv.style.display = 'none';
            instructionsBtn.textContent = 'Afficher les instructions';
        }
    });

    async function getData(url) {
        try {
            const res = await fetch(url);
            if (res && res.ok) {
                const data = await res.json();
                return data;
            }
        } catch (error) {
            console.error(error);
        }
    }

    async function buildInstList() {
        const instanceDataUrl =
            'https://raw.githubusercontent.com/fmoncomble/mastothreader/main/data/instances.json';
        const instanceData = await getData(instanceDataUrl);
        for (let iD of instanceData) {
            const instName = iD.instance;
            const option = document.createElement('option');
            option.value = instName;
            instanceDataList.appendChild(option);
        }
    }

    async function buildLangList() {
        const langDataUrl =
            'https://raw.githubusercontent.com/fmoncomble/mastothreader/main/data/languages.json';
        const langData = await getData(langDataUrl);
        for (let lD of langData) {
            const langValue = lD.value;
            const langName = lD.full_name;
            const option = document.createElement('option');
            option.value = langValue;
            option.textContent = langName;
            languageSelect.appendChild(option);
        }
    }

    const dlPic = document.getElementById('dl-pic');
    const dlMsg = document.getElementById('dl-msg');
    const pluginInstall = document.getElementById('plugin-install');
    const pluginLink = document.createElement('a');
    pluginLink.textContent = 'Installer sur votre navigateur';
    pluginLink.target = '_blank';
    pluginInstall.appendChild(pluginLink);
    const userAgent = navigator.userAgent;
    if (
        userAgent.indexOf('Chrome') !== -1 ||
        userAgent.indexOf('Edge') !== -1 ||
        userAgent.indexOf('OPR') !== -1 ||
        userAgent.indexOf('Opera') !== -1
    ) {
        pluginLink.href =
            'https://chromewebstore.google.com/detail/mastothreader-plugin/majdplkphamfebljfgebiniknbodhdgi';
    } else if (userAgent.indexOf('Firefox') !== -1) {
        pluginLink.href =
            'https://github.com/fmoncomble/mastothreader/releases/latest/download/mastothreader.xpi';
    } else if (
        userAgent.indexOf('Safari') !== -1 &&
        userAgent.indexOf('Chrome') === -1
    ) {
        pluginInstall.textContent = 'Plugin indisponible pour Safari';
    } else {
        pluginInstall.textContent = "Votre navigateur n'est pas pris en charge";
    }
    dlPic.onclick = () => {
        if (dlMsg.style.display === 'none') {
            dlMsg.style.display = 'flex';
        } else {
            dlMsg.style.display = 'none';
        }
    };

    let maxChars;
    let maxMedia;
    let lang;
    let userAvatarSrc;
    let postItems = [];
    let mediaFiles = [];
    let oldPosts = [];
    let i = 0;

    let instance;
    checkInstance();
    if (instance) {
        localStorage.removeItem(`${instance}-id`);
        localStorage.removeItem(`${instance}-secret`);
    }
    localStorage.removeItem('mastothreadtoken');
    let token;
    checkToken();

    let mastoText = null;
    let inReplyUrl = null;
    let userId = null;
    let bskyUrl = null;

    window.onload = async function () {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('bsky_url')) {
            bskyUrl = urlParams.get('bsky_url');
        }
        if (urlParams.has('instance')) {
            let originInstance = urlParams.get('instance');
            if (instance && originInstance !== instance) {
                if (
                    window.confirm(
                        `Vous venez de ${originInstance} mais êtes connecté·e à ${instance}.\nVoulez-vous changer d'instance ?`
                    )
                ) {
                    instanceInput.value = null;
                    instanceInput.disabled = false;
                    instanceBtn.textContent = 'Valider';
                    localStorage.removeItem('mastothreadinstance');
                    counter.style.display = 'none';
                    removeToken();
                    checkInstance();
                    checkToken();
                    window.location.reload();
                }
                checkCredentials();
            }
        }
        if (urlParams.has('user_id')) {
            userId = urlParams.get('user_id');
        }
        if (urlParams.has('reply_to')) {
            inReplyUrl = urlParams.get('reply_to');
        }
        if (urlParams.has('text')) {
            mastoText = urlParams.get('text');
        }
        if (!token && !instance) {
            for (let [key, value] of urlParams) {
                sessionStorage.setItem(key, value);
            }
            window.alert(`Vous n'êtes pas connecté·e à Mastodon.`);
            instanceInput.focus();
        }
        if (!token && instance) {
            code = urlParams.get('code');
            if (code) {
                token = await exchangeCodeForToken(code);
                if (token) {
                    localStorage.setItem('mastothreadtoken-v2', token);
                    bskyLink = sessionStorage.getItem('bsky_url') || null;
                    mastoText = sessionStorage.getItem('text') || null;
                    inReplyUrl = sessionStorage.getItem('reply_to') || null;
                    userId = sessionStorage.getItem('user_id') || null;
                    sessionStorage.clear();
                    checkToken();
                    if (bskyLink) {
                        if (
                            window.confirm(
                                `Voulez-vous importer le fil Bluesky ?`
                            )
                        ) {
                            fetchBskyCheckbox.checked = true;
                            await getBskyThread();
                        }
                    } else if (inReplyUrl) {
                        inReplyToInput.value = inReplyUrl;
                        inReplyToInput.dispatchEvent(new Event('input'));
                    }
                }
            }
        } else if (token) {
            await checkApp();
            if (bskyUrl) {
                if (window.confirm(`Voulez-vous importer le fil Bluesky ?`)) {
                    bskyLink = bskyUrl;
                    fetchBskyCheckbox.checked = true;
                    await getBskyThread();
                }
            }
            if (inReplyUrl) {
                inReplyToInput.value = inReplyUrl;
                inReplyToInput.dispatchEvent(new Event('input'));
            }
            if (userId) {
                await getUserAvatar();
            }
        }
        await buildInstList();
    };

    async function checkApp() {
        let res = fetch(`https://${instance}/api/v1/apps/verify_credentials`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        res.then(async (res) => {
            if (!res.ok) {
                const error = await res.json();
                window.alert(
                    `L'application n'est pas autorisée sur ${instance} : ${error.error}.\nVeuillez vous authentifier à nouveau.`
                );
                await removeToken();
                window.location.reload();
            }
        });
    }

    let clientId;
    let clientSecret;
    checkCredentials();
    function checkCredentials() {
        clientId = localStorage.getItem(`${instance}-id-v2`);
        clientSecret = localStorage.getItem(`${instance}-secret-v2`);
    }
    let code;

    function checkInstance() {
        instance = localStorage.getItem('mastothreadinstance');
        if (instance) {
            instanceInput.value = instance;
        } else if (!instance) {
            instanceInput.value = null;
        }
    }

    async function getUserAvatar() {
        if (userId) {
            try {
                let res = await fetch(
                    `https://${instance}/api/v1/accounts/${userId}`
                );
                let data = await res.json();
                if (res.ok) {
                    userAvatarSrc = data.avatar;
                } else {
                    console.error('Error fetching user: ', data.error);
                }
            } catch (error) {
                console.error('Error fetching user: ', error);
            }
        }
    }

    async function checkToken() {
        token = localStorage.getItem('mastothreadtoken-v2');
        if (token) {
            instanceInput.value = instance + ' ✅';
            instanceInput.disabled = true;
            instanceBtn.textContent = 'Réinitialiser';
            instructionsDiv.style.display = 'none';
            if (postItems.length === 0) {
                await getMax();
                await buildLangList();
                numberPostsDiv.style.display = 'flex';
                inReplyToDiv.style.display = 'block';
                await getUserAvatar();
                createNewPost(mastoText ? mastoText : null);
                postThreadBtn.style.display = 'flex';
            }
        } else if (!token) {
            instructionsDiv.style.display = 'flex';
            instructionsBtn.textContent = 'Masquer les instructions';
            instanceBtn.textContent = 'Valider';
        }
    }

    async function removeToken() {
        localStorage.removeItem('mastothreadtoken-v2');
        const formData = new FormData();
        formData.append('client_id', clientId);
        formData.append('client_secret', clientSecret);
        formData.append('token', token);
        const response = await fetch(`https://${instance}/oauth/revoke`, {
            method: 'POST',
            mode: 'no-cors',
            body: formData,
        });
        if (response.status === 403) {
            const error = await response.json();
            console.error('Token could not be revoked: ', error);
            window.alert(
                'La réinitialisation a échoué : ' + error.error_description
            );
        }
    }

    instanceInput.addEventListener('keydown', async (event) => {
        if (event.key === 'Enter') {
            instance = instanceInput.value;
            if (!instance) {
                window.alert('Veuillez indiquer votre instance Mastodon');
                return;
            }
            localStorage.setItem('mastothreadinstance', instance);
            checkCredentials();
            if (!clientId && !clientSecret) {
                await createMastoApp();
            }
            redirectToAuthServer();
            checkInstance();
            checkToken();
        }
    });

    instanceBtn.addEventListener('click', async () => {
        if (instanceInput.disabled) {
            instanceInput.value = null;
            instanceInput.disabled = false;
            instanceBtn.textContent = 'Valider';
            localStorage.removeItem('mastothreadinstance');
            counter.style.display = 'none';
            removeToken();
            checkInstance();
            checkToken();
            window.location.reload();
        } else {
            instance = instanceInput.value;
            if (!instance) {
                window.alert('Veuillez indiquer votre instance Mastodon');
                return;
            }
            localStorage.setItem('mastothreadinstance', instance);
            checkCredentials();
            if (!clientId && !clientSecret) {
                await createMastoApp();
            }
            redirectToAuthServer();
            checkInstance();
            checkToken();
        }
    });

    const redirectUri = window.location.href.split('?')[0];
    async function createMastoApp() {
        const createAppUrl = `https://${instance}/api/v1/apps`;
        try {
            const response = await fetch(createAppUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    client_name: 'MastoThreader',
                    redirect_uris: redirectUri,
                    scopes: 'read write',
                    website: redirectUri,
                }),
            });
            if (!response.ok) {
                if (response.status === 429) {
                    window.alert(
                        'Serveur occupé : veuillez réessayer plus tard.'
                    );
                    return;
                }
                console.error('Error creating app: response ', response.status);
                return;
            }
            const data = await response.json();
            clientId = data.client_id;
            clientSecret = data.client_secret;
            localStorage.setItem(`${instance}-id-v2`, clientId);
            localStorage.setItem(`${instance}-secret-v2`, clientSecret);
        } catch (error) {
            console.error('Error fetching: ', error);
        }
    }

    function redirectToAuthServer() {
        const scope = 'read write';
        const authUrl = `https://${instance}/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(
            redirectUri
        )}&scope=${encodeURIComponent(scope)}`;
        window.location.href = authUrl;
    }

    async function exchangeCodeForToken(authCode) {
        const tokenUrl = `https://${instance}/oauth/token`;

        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                code: authCode,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
            }),
        });
        const data = await response.json();
        return data.access_token;
    }

    let supportedMimeTypes;
    let mediaConfig = {};

    async function getMax() {
        const response = await fetch(`https://${instance}/api/v1/instance`);
        if (!response.ok) {
            console.error('Could not fetch instance');
            return;
        }
        const data = await response.json();
        maxChars = Number(data.configuration.statuses.max_characters);
        maxMedia = Number(data.configuration.statuses.max_media_attachments);
        lang = data.languages[0];
        mediaConfig = data.configuration.media_attachments;
    }

    let originalId;
    let originalUser;
    inReplyToInput.addEventListener('input', async () => {
        try {
            const inReplyToUrl = inReplyToInput.value.trim();
            if (inReplyToInput.value.trim() === '') {
                previewDiv.style.display = 'none';
                originalId = null;
                const firstPostItem = postItems[0];
                const textarea = firstPostItem.querySelector('.post-text');
                const text = textarea.value;
                if (originalUser && text.startsWith(originalUser)) {
                    textarea.value = text.replace(originalUser, '').trim();
                }
                originalUser = null;
                updateCharCount(firstPostItem, textarea.value);
                let message = 'Updating post list after clearing in-reply-to';
                updatePostList(message);
                return;
            }
            if (!inReplyToUrl.startsWith('http')) {
                return;
            }
            const res = await fetch(
                `https://${instance}/api/v2/search?q=${inReplyToUrl}&resolve=true`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );
            if (res.ok) {
                const data = await res.json();
                if (data.statuses.length === 0) {
                    return;
                }
                originalId = data.statuses[0].id;
                originalUser = `@${data.statuses[0].account.acct}`;
                const firstPostItem = postItems[0];
                const textarea = firstPostItem.querySelector('.post-text');
                updateCharCount(firstPostItem, textarea.value);
                createRepliedPostPreview(data.statuses[0]);
                textarea.focus();
            }
        } catch (error) {
            console.error(error);
        }
    });

    function createRepliedPostPreview(status) {
        const previewAvatar = document.getElementById('replied-post-avatar');
        previewAvatar.innerHTML = null;
        const previewName = document.getElementById(
            'replied-post-display-name'
        );
        previewName.innerHTML = null;
        const previewTime = document.getElementById('replied-post-time');
        previewTime.innerHTML = null;

        const avatar = document.createElement('img');
        avatar.src = status.account.avatar;
        avatar.alt = status.account.display_name;
        previewAvatar.appendChild(avatar);

        const name = document.createElement('span');
        name.textContent = status.account.display_name;
        previewName.appendChild(name);

        const time = document.createElement('time');
        time.textContent = new Date(status.created_at).toLocaleString();
        previewTime.appendChild(time);

        const previewTextDiv = document.getElementById('replied-post-text');
        const previewMediaDiv = document.getElementById('replied-post-media');

        const previewText = status.content;
        previewTextDiv.innerHTML = previewText;

        previewMediaDiv.innerHTML = null;
        const media = status.media_attachments;
        for (let m of media) {
            const img = document.createElement('img');
            img.src = m.preview_url;
            img.alt = m.description;
            previewMediaDiv.appendChild(img);
        }

        const closeBtn = document.getElementById('reply-preview-close');
        closeBtn.onclick = () => {
            inReplyToInput.value = null;
            previewDiv.style.display = 'none';
            inReplyUrl = null;
            originalId = null;
            originalUser = null;
            const firstPostItem = postItems[0];
            const textarea = firstPostItem.querySelector('.post-text');
            updateCharCount(firstPostItem, textarea.value);
            let message = 'Updating post list after clearing in-reply-to';
            updatePostList(message);
        };

        previewDiv.style.display = 'flex';
        let message = 'Updating post list after setting in-reply-to';
        updatePostList(message);
    }

    function updateCharCount(post, postText) {
        const charCount = post.querySelector('.char-count');
        charCount.textContent = `${postText.length}/${maxChars}`;
        if (postText.length > maxChars) {
            postText = postText.trim();
            charCount.style.color = '#cc0000';
            charCount.style.fontWeight = 'bold';
        } else {
            charCount.removeAttribute('style');
        }
    }

    let defaultViz = 'public';
    let currentPost;
    let splitNb = 0;
    let isSplitting = false;

    let bskyDid = localStorage.getItem('bsky-did')
        ? localStorage.getItem('bsky-did')
        : null;
    let bskyHandle = localStorage.getItem('bsky-handle')
        ? localStorage.getItem('bsky-handle')
        : null;

    if (bskyDid && bskyHandle) {
        bskyResetBtn.style.display = 'inline-block';
    } else {
        bskyResetBtn.style.display = 'none';
    }

    bskyResetBtn.addEventListener('click', () => {
        bskyDid = null;
        bskyHandle = null;
        localStorage.removeItem('bsky-did');
        localStorage.removeItem('bsky-handle');
        fetchBskyCheckbox.checked = false;
        bskyLink = null;
        bskyThreadInput.value = null;
        bskyResetBtn.style.display = 'none';
    });

    let bskyPosts = [];
    let fromBsky = false;
    let convertHandles = false;
    let bskyLink = null;

    const bskyAuthDialog = document.getElementById('bsky-auth-dialog');
    const idInput = document.getElementById('id-input');
    const pwdInput = document.getElementById('pwd-input');
    const submitBtn = document.getElementById('bsky-login-btn');
    const cancelBskyLoginBtn = document.getElementById('bsky-cancel-btn');
    cancelBskyLoginBtn.addEventListener('click', () => {
        bskyAuthDialog.close();
        fetchBskyCheckbox.checked = false;
    });
    submitBtn.addEventListener('click', async () => {
        const form = {};
        form.identifier = idInput.value;
        form.password = pwdInput.value;
        const res = await fetch(
            `https://bsky.social/xrpc/com.atproto.server.createSession`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(form),
            }
        );
        if (res.ok) {
            const data = await res.json();
            bskyAuthDialog.close();
            bskyDid = data.did;
            localStorage.setItem('bsky-did', bskyDid);
            bskyHandle = data.handle;
            localStorage.setItem('bsky-handle', bskyHandle);
            bskyResetBtn.style.display = 'inline-block';
            idInput.value = null;
            pwdInput.value = null;
            await new Promise((resolve) => setTimeout(resolve, 0));
            if (!bskyLink) {
                bskyThreadInput.value = null;
                bskyThreadDialog.showModal();
            } else {
                getBskyThread();
            }
        } else {
            idInput.value = null;
            pwdInput.value = null;
            const errorData = await res.json();
            if (res.status === 429) {
                const resHeaders = res.headers;
                const resetTime = resHeaders.get('Ratelimit-Reset');
                const now = Math.floor(Date.now() / 1000);
                const waitTime = resetTime - now;
                const hours = Math.floor(waitTime / 3600);
                const minutes = Math.floor((waitTime % 3600) / 60);
                const seconds = waitTime % 60;
                const timeString = `${hours} heures, ${minutes} minutes et ${seconds} secondes`;
                window.alert(
                    `Trop de tentatives de connexion.\nVeuillez réessayer dans ${timeString}.`
                );
                bskyAuthDialog.close();
                fetchBskyCheckbox.checked = false;
                return;
            }
            window.alert(`Erreur d'authentification: ${errorData.message}`);
            fetchBskyCheckbox.checked = false;
            bskyAuthDialog.close();
            return;
        }
    });

    const bskyThreadDialog = document.getElementById('bsky-thread-dialog');
    const bskyThreadInput = document.getElementById('bsky-thread-input');
    bskyThreadInput.value = null;
    const bskyThreadOk = document.getElementById('bsky-thread-ok');
    const bskyThreadCancel = document.getElementById('bsky-thread-cancel');
    const convertHandlesCheckbox = document.getElementById('convert-handles');
    convertHandlesCheckbox.checked = false;
    convertHandlesCheckbox.addEventListener('change', () => {
        if (convertHandlesCheckbox.checked) {
            convertHandles = true;
        } else {
            convertHandles = false;
        }
    });
    bskyThreadOk.addEventListener('click', () => {
        bskyLink = bskyThreadInput.value;
        getBskyThread();
        bskyThreadDialog.close();
    });
    bskyThreadInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            bskyLink = bskyThreadInput.value;
            getBskyThread();
            bskyThreadDialog.close();
        } else if (event.key === 'Escape') {
            bskyLink = null;
            fetchBskyCheckbox.checked = false;
            bskyThreadInput.value = null;
            bskyThreadDialog.close();
        }
    });
    bskyThreadCancel.addEventListener('click', () => {
        bskyLink = null;
        fetchBskyCheckbox.checked = false;
        bskyThreadInput.value = null;
        bskyThreadDialog.close();
    });

    fetchBskyCheckbox.addEventListener('change', async () => {
        if (fetchBskyCheckbox.checked) {
            if (!bskyDid) {
                bskyAuthDialog.showModal();
            } else if (bskyDid && bskyHandle) {
                bskyThreadInput.value = null;
                bskyThreadDialog.showModal();
            }
        } else {
            for (let p of postItems) {
                p.remove();
            }
            postItems = [];
            bskyPosts = [];
            fromBsky = false;
            const bskyDiv = document.getElementById('bsky-link');
            if (bskyDiv) {
                bskyDiv.remove();
            }
            createNewPost();
        }
    });

    async function getBskyThread() {
        if (!bskyDid || !bskyHandle) {
            if (
                window.confirm(
                    `MastoThreader n'est pas connecté à Bluesky.\nVoulez-vous vous identifier ?`
                )
            ) {
                bskyDid = null;
                bskyHandle = null;
                localStorage.removeItem('bsky-did');
                localStorage.removeItem('bsky-handle');
                bskyAuthDialog.showModal();
                return;
            } else {
                bskyLink = null;
                fetchBskyCheckbox.checked = false;
                bskyLoadingSpinner.close();
                return;
            }
        }
        if (bskyLink) {
            const bskyLoadingText =
                document.getElementById('bsky-loading-text');
            bskyLoadingSpinner.showModal();
            let pathname;
            try {
                pathname = new URL(bskyLink).pathname;
            } catch (error) {
                bskyThreadInput.value = null;
                window.alert('Lien Bluesky invalide.');
                bskyLink = null;
                fetchBskyCheckbox.checked = false;
                bskyLoadingSpinner.close();
                return;
            }
            let handle = pathname.split('/')[2];
            if (
                (handle.startsWith('did:plc:') && handle !== bskyDid) ||
                (!handle.startsWith('did:plc:') && handle !== bskyHandle)
            ) {
                if (
                    window.confirm(
                        `Échec : vous n’êtes pas l’auteur du fil Bluesky.\nVoulez-vous vous connecter avec un autre compte ?`
                    )
                ) {
                    bskyDid = null;
                    bskyHandle = null;
                    localStorage.removeItem('bsky-did');
                    localStorage.removeItem('bsky-handle');
                    bskyAuthDialog.showModal();
                    return;
                } else {
                    bskyLink = null;
                    fetchBskyCheckbox.checked = false;
                    bskyLoadingSpinner.close();
                    return;
                }
            }
            let rkey = pathname.split('/')[4];
            if (rkey) {
                let uri = `at://${bskyDid}/app.bsky.feed.post/${rkey}`;
                let res = await fetch(
                    `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${uri}&depth=1000`
                );
                if (res.ok) {
                    bskyThreadInput.value = null;
                    let data = await res.json();
                    let div = document.createElement('div');
                    div.id = 'bsky-link';
                    div.classList.add('number-posts');
                    let a = document.createElement('a');
                    a.href = bskyLink;
                    a.target = '_blank';
                    a.textContent = bskyLink;
                    div.appendChild(a);
                    numberPostsDiv.after(div);
                    let thread = data.thread;
                    let firstPost = thread.post;
                    bskyPosts.push(firstPost);
                    findSelfReplies(thread);
                    function findSelfReplies(post) {
                        if (post.replies) {
                            let selfReply = post.replies.find(
                                (r) =>
                                    r.post.author.did === post.post.author.did
                            );
                            if (selfReply) {
                                bskyPosts.push(selfReply.post);
                                findSelfReplies(selfReply);
                            } else {
                                return;
                            }
                        } else {
                            return;
                        }
                    }
                    if (postItems && postItems.length > 0) {
                        postItems[0].remove();
                    }
                    postItems = [];
                    for (let p of bskyPosts) {
                        let index = bskyPosts.indexOf(p) + 1;
                        bskyLoadingText.textContent = `Chargement du post ${index}/${bskyPosts.length}...`;
                        try {
                            let text = p.record.text;
                            if (convertHandles) {
                                let regex = /@.+?\s/g;
                                let mentions = text.match(regex);
                                if (mentions) {
                                    for (let m of mentions) {
                                        let handle = m
                                            .slice(1)
                                            .toLowerCase()
                                            .trim();
                                        handle = handle.split('.')[0];
                                        let searchUrl = `https://${instance}/api/v2/search?q=${handle}&type=accounts&resolve=true`;
                                        let res = await fetch(searchUrl, {
                                            headers: {
                                                Authorization: `Bearer ${token}`,
                                            },
                                        });
                                        if (res.ok) {
                                            let data = await res.json();
                                            if (data.accounts.length > 0) {
                                                let account = data.accounts[0];
                                                let acct = account.acct;
                                                text = text.replaceAll(
                                                    m,
                                                    `${acct} `
                                                );
                                            } else {
                                                continue;
                                            }
                                        } else {
                                            continue;
                                        }
                                    }
                                }
                            }
                            let imgs = [];
                            if (p.embed) {
                                let images = [];
                                if (
                                    p.embed.images &&
                                    p.embed.images.length > 0
                                ) {
                                    images.push(...p.embed.images);
                                }
                                if (p.embed.media) {
                                    if (p.embed.media.images) {
                                        images.push(...p.embed.media.images);
                                    }
                                }
                                if (images && images.length > 0) {
                                    for (let i of images) {
                                        let img = {};
                                        img.type = 'image';
                                        img.url = i.fullsize;
                                        img.thumbnail = i.thumb;
                                        img.alt = i.alt;
                                        imgs.push(img);
                                    }
                                }
                                if (p.embed.$type.includes('video')) {
                                    let video = p.embed;
                                    let vid = {};
                                    vid.type = 'video';
                                    vid.thumbnail = video.thumbnail;
                                    vid.url = video.playlist;
                                    vid.alt = video.alt;
                                    imgs.push(vid);
                                }
                                if (p.embed.record) {
                                    let uri =
                                        p.embed.record.uri ||
                                        p.embed.record.record.uri;
                                    let elts = uri.split('/');
                                    let rDid = elts[2];
                                    let rKey = elts[4];
                                    let rUrl = `https://bsky.app/profile/${rDid}/post/${rKey}`;
                                    text += `\n\n${rUrl}`;
                                }
                                let card = p.embed.external;
                                if (!card && p.embed.media) {
                                    card = p.embed.media.external;
                                }
                                if (card) {
                                    let cardUrl = card.uri;
                                    if (cardUrl) {
                                        if (cardUrl.includes('.gif')) {
                                            let img = {};
                                            img.type = 'image';
                                            img.url = cardUrl;
                                            img.alt = card.description;
                                            imgs.push(img);
                                        } else {
                                            text += `\n\n${cardUrl}`;
                                        }
                                    }
                                }
                            }
                            fromBsky = true;
                            await createNewPost(text, imgs);
                            currentPost = postItems[bskyPosts.indexOf(p)];
                        } catch (error) {
                            console.error(
                                `Error creating post ${
                                    bskyPosts.indexOf(p) + 1
                                }: `,
                                error
                            );
                        }
                    }
                } else {
                    bskyThreadInput.value = null;
                    window.alert('Impossible de récupérer le fil Bluesky.');
                    bskyLink = null;
                    fetchBskyCheckbox.checked = false;
                    fromBsky = false;
                    bskyLoadingSpinner.close();
                    return;
                }
            } else {
                window.alert('Impossible de récupérer le fil Bluesky.');
                bskyLink = null;
                fetchBskyCheckbox.checked = false;
                fromBsky = false;
                bskyLoadingSpinner.close();
                return;
            }
            bskyLoadingSpinner.close();
            postItems[0].querySelector('.post-text').focus();
            window.scrollTo(0, 0);
            await new Promise((resolve) => setTimeout(resolve, 0));
            window.alert(
                'Le fil est prêt, pensez à le relire avant de publier !'
            );
        } else {
            fetchBskyCheckbox.checked = false;
        }
    }

    async function createNewPost(text, imgs) {
        oldPosts = postItems.map(function (p) {
            return p.getAttribute('counter');
        });
        const newPost = postItem.cloneNode(true);
        const addPostBtn = newPost.querySelector('.add-post-btn');
        if (postItems.length === 0) {
            contentContainer.appendChild(newPost);
            postItems.push(newPost);
        } else {
            currentPost.after(newPost);
            const currentIndex = postItems.indexOf(currentPost);
            const newIndex = currentIndex + 1;
            postItems.splice(newIndex, 0, newPost);
        }
        updatePostCount();
        oldPosts.splice(postItems.indexOf(newPost), 0, 'skip');
        let message = 'Updating list of posts after creation';

        const avatar = newPost.querySelector('.avatar');
        if (userAvatarSrc) {
            avatar.src = userAvatarSrc;
        } else {
            avatar.src = 'icons/generic_avatar.png';
        }

        const vizSelect = newPost.querySelector('.viz-select');
        const index = postItems.indexOf(newPost);
        if (index === 0) {
            vizSelect.value = 'public';
        } else {
            if (defaultViz !== 'public') {
                vizSelect.value = defaultViz;
            } else {
                vizSelect.value = 'unlisted';
            }
        }

        vizSelect.addEventListener('change', () => {
            const newIndex = postItems.indexOf(newPost);
            if (newIndex === 0) {
                defaultViz = vizSelect.value;
                if (defaultViz !== 'public') {
                    for (let p of postItems) {
                        const vizS = p.querySelector('.viz-select');
                        vizS.value = defaultViz;
                    }
                }
            }
        });

        const langSelect = newPost.querySelector('.lang-select');
        langSelect.value = lang;
        langSelect.addEventListener('change', () => {
            lang = langSelect.value;
        });

        i++;
        newPost.id = 'post-' + i;
        for (let p of postItems) {
            const deletePostBtn = p.querySelector('.delete-post-btn');
            if (postItems.length > 1) {
                deletePostBtn.style.display = 'inline-block';
            }
        }

        newPost.style.display = 'block';
        addPostBtn.addEventListener('click', () => {
            if (postItems.length > 0) {
                currentPost = addPostBtn.parentElement;
            }
            createNewPost();
        });

        const charCount = newPost.querySelector('.char-count');
        charCount.textContent = `0/${maxChars}`;

        const textarea = newPost.querySelector('.post-text');
        if (text) {
            if (text.length > maxChars) {
                await splitIntoToots(newPost, text, textarea);
            } else {
                textarea.value = text;
                updateCharCount(newPost, text);
                textarea.focus();
            }
        } else {
            textarea.value = null;
            textarea.focus();
        }
        if (originalUser && postItems.indexOf(newPost) === 0) {
            updateCharCount(newPost, textarea.value);
        }

        textarea.addEventListener('input', async () => {
            let postText = textarea.value;
            if (postText.length > 30) {
                let language = franc(postText);
                if (language === 'und') {
                    language = lang;
                } else {
                    lang = iso6393.find((l) => l.iso6393 === language).iso6391;
                }
                langSelect.value = lang;
            }
            updateCharCount(newPost, postText);
            if (postText.length > maxChars) {
                await splitIntoToots(newPost, postText, textarea);
            } else {
                charCount.removeAttribute('style');
            }
        });

        textarea.addEventListener('focus', async () => {
            let postText = textarea.value;
            updateCharCount(newPost, postText);
            if (postText.length > maxChars) {
                await splitIntoToots(newPost, postText, textarea);
            } else {
                charCount.removeAttribute('style');
            }
        });

        const cwDiv = newPost.querySelector('.cw-div');
        const cwText = newPost.querySelector('.cw-text');
        const cwBtn = newPost.querySelector('.cw-btn');
        cwBtn.addEventListener('click', () => {
            if (cwDiv.style.display === 'none') {
                cwDiv.style.display = 'inline-flex';
                cwBtn.style.color = '#cc0000';
                cwBtn.style.borderColor = '#cc0000';
                cwBtn.style.textDecorationLine = 'line-through';
                cwBtn.title = "Supprimer l'avertissement";
            } else {
                cwText.value = null;
                cwDiv.style.display = 'none';
                cwBtn.removeAttribute('style');
                cwBtn.title = 'Ajouter un avertissement';
            }
        });

        mediaFiles[`mediaFiles${i}`] = [];
        let files = mediaFiles[`mediaFiles${i}`];

        const imgCount = newPost.querySelector('.img-count');
        imgCount.textContent = `0/${maxMedia}`;

        const dropzone = newPost.querySelector('.dropzone');
        const dzInst = dropzone.querySelector('.dz-inst');
        const imgPreview = dropzone.querySelector('.img-preview');

        if (fromBsky && imgs && imgs.length > 0) {
            dzInst.style.display = 'none';
            const proxyUrl = 'https://corsproxy.io/';
            for (let img of imgs) {
                if (img.type === 'video') {
                    let mediaFile = {};
                    let baseUrl = img.url.split('playlist.m3u8')[0];
                    await getVideo(baseUrl, img, mediaFile, i);
                    async function getVideo(baseUrl, img, mediaFile, i) {
                        async function getManifest() {
                            const res = await fetch(img.url);
                            const data = await res.text();
                            return data;
                        }
                        const manifest = await getManifest();
                        let maxRes = 0;
                        function getMaxRes() {
                            const lines = manifest.split('\n');
                            for (let l of lines) {
                                if (l.startsWith('#EXT-X-STREAM-INF')) {
                                    let res = l
                                        .split('RESOLUTION=')[1]
                                        .split('x')[1];
                                    if (res > maxRes) {
                                        maxRes = res;
                                    }
                                }
                            }
                            return lines.find((l) =>
                                l.startsWith(maxRes.toString())
                            );
                        }
                        const playlistUrl = baseUrl + getMaxRes();
                        const tsUrls = [];
                        async function getTsUrls(playlistUrl) {
                            const res = await fetch(playlistUrl);
                            const data = await res.text();
                            const lines = data.split('\n');
                            for (let l of lines) {
                                if (l.includes('video') && l.includes('.ts')) {
                                    tsUrls.push(`${baseUrl}${maxRes}p/${l}`);
                                }
                            }
                        }
                        await getTsUrls(playlistUrl);
                        const file = await getVideo(tsUrls);
                        async function getVideo(tsUrls) {
                            let mime = 'video/mp4';
                            async function transmuxSegments(tsUrls) {
                                let segments = [];
                                let transmuxer = new muxjs.mp4.Transmuxer();
                                if (tsUrls.length === 0) {
                                    return;
                                }
                                transmuxer.on('data', function (segment) {
                                    let data = new Uint8Array(
                                        segment.initSegment.byteLength +
                                            segment.data.byteLength
                                    );
                                    data.set(segment.initSegment, 0);
                                    data.set(
                                        segment.data,
                                        segment.initSegment.byteLength
                                    );
                                    segments.push(data);
                                });
                                for (let url of tsUrls) {
                                    const response = await fetch(url);
                                    const data = await response.arrayBuffer();
                                    transmuxer.push(new Uint8Array(data));
                                }
                                transmuxer.flush();
                                return segments;
                            }
                            async function createBlob(tsUrls) {
                                const segments = await transmuxSegments(tsUrls);
                                const blob = new Blob(segments, { type: mime });
                                return blob;
                            }
                            const blob = await createBlob(tsUrls);
                            const videoFile = new File([blob], 'video.mp4', {
                                type: blob.type,
                            });
                            return videoFile;
                        }
                        mediaFile.file = file;
                    }
                    mediaFile.thumbnail = img.thumbnail;
                    mediaFile.description = img.alt;
                    files.push(mediaFile);
                    displayThumbnail(mediaFile, imgPreview, imgCount, dzInst);
                } else if (img.type === 'image') {
                    fetch(proxyUrl + encodeURIComponent(img.url))
                        .then((response) => response.blob())
                        .then((blob) => {
                            const file = new File([blob], 'image.jpg', {
                                type: blob.type,
                            });
                            let mediaFile = {};
                            mediaFile.file = file;
                            if (img.alt) {
                                mediaFile.description = img.alt;
                            }
                            files.push(mediaFile);
                            displayThumbnail(
                                mediaFile,
                                imgPreview,
                                imgCount,
                                dzInst
                            );
                        })
                        .catch((error) =>
                            console.error('Error fetching image:', error)
                        );
                }
            }
        }

        const overlay = newPost.querySelector('div.overlay');
        newPost.addEventListener('dragover', (e) => {
            e.preventDefault();
            overlay.style.display = 'flex';
        });

        overlay.addEventListener('dragleave', (e) => {
            e.preventDefault();
            overlay.style.display = 'none';
        });

        newPost.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropzone.classList.remove('dz-active');
            overlay.style.display = 'none';
            dzInst.style.display = 'none';
            const newFiles = e.dataTransfer.items;
            if (files.length >= maxMedia) {
                window.alert("Le nombre maximum d'images est atteint.");
                return;
            } else {
                for (let f of newFiles) {
                    if (files.length < maxMedia) {
                        let mediaFile = {};
                        if (f.kind === 'file') {
                            f = f.getAsFile();
                            mediaFile.file = f;
                            files.push(mediaFile);
                            displayThumbnail(
                                mediaFile,
                                imgPreview,
                                imgCount,
                                dzInst
                            );
                        } else if (
                            f.kind === 'string' &&
                            f.type === 'text/uri-list'
                        ) {
                            f.getAsString((url) => {
                                fetch(url)
                                    .then((response) => response.blob())
                                    .then((blob) => {
                                        const file = new File(
                                            [blob],
                                            'image.jpg',
                                            { type: blob.type }
                                        );
                                        mediaFile.file = file;
                                        files.push(mediaFile);
                                        displayThumbnail(
                                            mediaFile,
                                            imgPreview,
                                            imgCount,
                                            dzInst
                                        );
                                    })
                                    .catch((error) =>
                                        console.error(
                                            'Error fetching image:',
                                            error
                                        )
                                    );
                            });
                        }
                    } else {
                        window.alert("Le nombre maximum d'images est atteint");
                        break;
                    }
                }
            }
        });

        const imgUpload = newPost.querySelector('input.img-upload');
        const addImg = newPost.querySelector('div.add-img');
        addImg.onclick = () => {
            imgUpload.click();
        };
        imgUpload.addEventListener('change', async (e) => {
            dzInst.style.display = 'none';
            const newFiles = e.target.files;
            if (files.length >= maxMedia) {
                window.alert("Le nombre maximum d'images est atteint.");
                return;
            } else {
                for (let f of newFiles) {
                    if (files.length < maxMedia) {
                        let mediaFile = {};
                        mediaFile.file = f;
                        files.push(mediaFile);
                        displayThumbnail(
                            mediaFile,
                            imgPreview,
                            imgCount,
                            dzInst
                        );
                    } else {
                        window.alert("Le nombre maximum d'images est atteint");
                        break;
                    }
                }
            }
        });

        textarea.addEventListener('paste', (e) => {
            dropzone.classList.remove('dz-active');
            overlay.style.display = 'none';
            dzInst.style.display = 'none';
            const items = (e.clipboardData || e.originalEvent.clipboardData)
                .items;
            for (let item of items) {
                if (item.kind === 'file') {
                    let mediaFile = {};
                    const file = item.getAsFile();
                    if (files.length < maxMedia) {
                        mediaFile.file = file;
                        files.push(mediaFile);
                        displayThumbnail(
                            mediaFile,
                            imgPreview,
                            imgCount,
                            dzInst
                        );
                    } else {
                        window.alert("Le nombre maximum d'images est atteint");
                        break;
                    }
                }
            }
        });

        function displayThumbnail(mediaFile, imgPreview, imgCount, dzInst) {
            imgCount.textContent = `${files.length}/${maxMedia}`;
            const div = document.createElement('div');
            const removeBtn = document.createElement('button');
            let previewElt;
            let fileType = mediaFile.file.type;
            let supportedMimeTypes = new Set(mediaConfig.supported_mime_types);
            let altLimit = mediaConfig.description_limit || 1500;
            let imgSizeLimit = mediaConfig.image_size_limit;
            let vidSizeLimit = mediaConfig.video_size_limit;

            if (!supportedMimeTypes.has(fileType)) {
                window.alert('Type de fichier non pris en charge.');
                const index = files.indexOf(mediaFile);
                if (index > -1) {
                    files.splice(index, 1);
                }
                div.remove();
                imgCount.textContent = `${files.length}/${maxMedia}`;
                if (files.length === 0) {
                    dzInst.style.display = 'block';
                }
                return;
            }

            if (fileType.includes('video')) {
                if (mediaFile.file.size > vidSizeLimit) {
                    window.alert(
                        `La taille de la vidéo dépasse la limite de ${
                            vidSizeLimit / 1000000
                        } Mo.`
                    );
                    const index = files.indexOf(mediaFile);
                    if (index > -1) {
                        files.splice(index, 1);
                    }
                    div.remove();
                    imgCount.textContent = `${files.length}/${maxMedia}`;
                    if (files.length === 0) {
                        dzInst.style.display = 'block';
                    }
                    return;
                }
                const video = document.createElement('video');
                if (!video.canPlayType(mediaFile.file.type)) {
                    video.poster = 'icons/video_placeholder.webp';
                    video.controls = false;
                } else {
                    video.src = URL.createObjectURL(mediaFile.file);
                    video.controls = false;
                    video.muted = true;
                    video.playsinline = true;
                    if (mediaFile.thumbnail) {
                        video.poster = mediaFile.thumbnail;
                    }
                }
                previewElt = video;
                div.appendChild(video);
            } else if (fileType.includes('image')) {
                if (mediaFile.file.size > imgSizeLimit) {
                    window.alert(
                        `La taille de l'image dépasse la limite de ${
                            imgSizeLimit / 1000000
                        } Mo.`
                    );
                    const index = files.indexOf(mediaFile);
                    if (index > -1) {
                        files.splice(index, 1);
                    }
                    div.remove();
                    imgCount.textContent = `${files.length}/${maxMedia}`;
                    if (files.length === 0) {
                        dzInst.style.display = 'block';
                    }
                    return;
                }
                const image = mediaFile.file;
                const imgReader = new FileReader();
                imgReader.onload = function (e) {
                    const img = new Image();
                    img.src = e.target.result;
                    img.alt = mediaFile.description;
                    img.onload = function () {
                        previewElt = img;
                        div.lastElementChild.before(img);
                    };
                };
                imgReader.readAsDataURL(image);
            } else if (fileType.includes('audio')) {
                const audio = document.createElement('audio');
                audio.src = URL.createObjectURL(mediaFile.file);
                audio.controls = false;
                audio.muted = true;
                audio.alt = mediaFile.description;
                audio.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                });
                previewElt = audio;
                div.appendChild(audio);
                const audioImg = document.createElement('img');
                audioImg.src = 'icons/speaker_icon.png';
                audioImg.alt = 'Audio';
                div.appendChild(audioImg);
            }

            removeBtn.textContent = '✖';
            removeBtn.classList.add('remove-btn');

            removeBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const index = files.indexOf(mediaFile);
                if (index > -1) {
                    files.splice(index, 1);
                }
                div.remove();
                imgCount.textContent = `${files.length}/${maxMedia}`;
                if (files.length === 0) {
                    dzInst.style.display = 'block';
                }
            });

            div.addEventListener('click', (e) => {
                e.preventDefault();
                const zoomed = document.createElement('dialog');
                zoomed.classList.add('zoomed');
                const zoomedElt = previewElt.cloneNode(true);
                zoomedElt.classList.add('zoomed');
                if (
                    zoomedElt.tagName === 'VIDEO' ||
                    zoomedElt.tagName === 'AUDIO'
                ) {
                    zoomedElt.controls = true;
                }
                zoomed.addEventListener('click', (e) => {
                    e.preventDefault();
                    zoomed.remove();
                });
                zoomed.addEventListener('keydown', (e) => {
                    e.preventDefault();
                    if (e.key === 'Escape') {
                        zoomed.remove();
                    }
                });
                zoomedElt.addEventListener('play', () => {
                    zoomed.focus();
                });
                zoomed.appendChild(zoomedElt);
                document.body.appendChild(zoomed);
                zoomed.showModal();
            });

            div.appendChild(removeBtn);
            imgPreview.appendChild(div);

            const altBtn = document.createElement('button');
            altBtn.textContent = 'ALT';
            altBtn.classList.add('alt-btn');
            const altDiv = imgPreview.querySelector('.alt-div');
            const newAltDiv = altDiv.cloneNode(true);
            const altTextArea = newAltDiv.querySelector('.alt-text');

            if (mediaFile.description) {
                altTextArea.value = mediaFile.description;
                altBtn.style.color = '#009900';
                if (previewElt) {
                    previewElt.alt = mediaFile.description;
                    previewElt.title = mediaFile.description;
                }
            }

            const altCounter = newAltDiv.querySelector('.alt-counter');
            newAltDiv.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            altTextArea.addEventListener('input', () => {
                altCounter.textContent = `${altTextArea.value.length}/${altLimit}`;
                if (altTextArea.value.length > 0) {
                    altCancelBtn.textContent = 'Effacer';
                } else if (altTextArea.value.length === 0) {
                    altCancelBtn.textContent = 'Annuler';
                }
                if (altTextArea.value.length > altLimit) {
                    altCounter.style.color = '#cc0000';
                    altCounter.style.fontWeight = 'bold';
                } else {
                    altCounter.removeAttribute('style');
                }
            });
            altTextArea.addEventListener('keydown', (e) => {
                const altText = altTextArea.value;
                if (
                    (e.key === 'Enter' && e.metaKey) ||
                    (e.key === 'Enter' && e.ctrlKey)
                ) {
                    if (altText && altText.length > 0) {
                        if (previewElt) {
                            previewElt.alt = altText;
                            previewElt.title = altText;
                        }
                        mediaFile.description = altText;
                        altBtn.style.color = '#009900';
                    } else if (!altText || altText.length === 0) {
                        if (previewElt) {
                            previewElt.removeAttribute('alt');
                            previewElt.removeAttribute('title');
                        }
                        delete mediaFile.description;
                        altBtn.removeAttribute('style');
                    }
                    newAltDiv.style.display = 'none';
                } else if (e.key === 'Escape') {
                    newAltDiv.style.display = 'none';
                }
            });

            const altSaveBtn = newAltDiv.querySelector('.alt-save-btn');
            const altCancelBtn = newAltDiv.querySelector('.alt-cancel-btn');
            altBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (newAltDiv.style.display === 'flex') {
                    newAltDiv.style.display = 'none';
                } else {
                    const altText = altTextArea.value;
                    if (altText) {
                        altCancelBtn.textContent = 'Effacer';
                    } else {
                        altCancelBtn.textContent = 'Annuler';
                    }
                    newAltDiv.style.display = 'flex';
                    newAltDiv.scrollIntoView();
                    altTextArea.focus();
                }
            });
            altSaveBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const altText = altTextArea.value;
                if (altText && altText.length > 0) {
                    if (previewElt) {
                        previewElt.alt = altText;
                        previewElt.title = altText;
                    }
                    mediaFile.description = altText;
                    altBtn.style.color = '#009900';
                } else if (!altText || altText.length === 0) {
                    if (previewElt) {
                        previewElt.removeAttribute('alt');
                        previewElt.removeAttribute('title');
                    }
                    delete mediaFile.description;
                    altBtn.removeAttribute('style');
                }
                newAltDiv.style.display = 'none';
            });
            altCancelBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const altText = altTextArea.value;
                if (altText.length > 0) {
                    altTextArea.value = null;
                    if (previewElt) {
                        previewElt.removeAttribute('alt');
                        previewElt.removeAttribute('title');
                    }
                    altCounter.textContent = `0/${altLimit}`;
                    altCancelBtn.textContent = 'Annuler';
                } else if (altText.length === 0) {
                    if (previewElt) {
                        previewElt.removeAttribute('alt');
                        previewElt.removeAttribute('title');
                    }
                    delete mediaFile.description;
                    altBtn.removeAttribute('style');
                    newAltDiv.style.display = 'none';
                }
            });

            div.appendChild(altBtn);
            div.appendChild(newAltDiv);

            if (!mediaFile.description) {
                // setTimeout(() => {
                const altText = altTextArea.value;
                if (altText) {
                    altCancelBtn.textContent = 'Effacer';
                } else {
                    altCancelBtn.textContent = 'Annuler';
                }
                newAltDiv.style.display = 'flex';
                newAltDiv.scrollIntoView();
                altTextArea.focus();
                // }, 500);
            }
        }

        const deletePostBtn = newPost.querySelector('.delete-post-btn');
        deletePostBtn.addEventListener('click', () => {
            const index = postItems.indexOf(newPost);
            if (postItems.length > 1) {
                const id = newPost.id.split('-')[1];
                oldPosts = postItems.map(function (p) {
                    return p.getAttribute('counter');
                });
                postItems.splice(index, 1);
                let nbOfPosts = updatePostCount();
                newPost.remove();
                delete mediaFiles[`mediaFiles${id}`];
                oldPosts.splice(index, 1);
                let message = 'Updating list of posts after delete';
                updatePostList(message, oldPosts, nbOfPosts);
                if (postItems.length === 1) {
                    const post = postItems[0];
                    const delBtn = post.querySelector('.delete-post-btn');
                    delBtn.style.display = 'none';
                }
            }
            const firstPost = postItems[0];
            if (originalUser) {
                const textarea = firstPost.querySelector('.post-text');
                updateCharCount(firstPost, textarea.value);
            }
            const firstVizSelect = firstPost.querySelector('.viz-select');
            firstVizSelect.value = defaultViz;
        });
        updatePostList(message, oldPosts);
        textarea.focus();
        return newPost;
    }

    async function splitIntoToots(newPost, postText, textarea) {
        if (isSplitting) {
            return;
        }
        isSplitting = true;
        splitNb++;
        textarea.value = null;
        postText = postText.trim();
        const regex = /([,.;:!?])/gu;
        const chunks = postText.split(regex);
        let remainingChunks;
        for (let i = 0; i < chunks.length; i += 2) {
            let chunk1 = chunks[i];
            let chunk2 = chunks[i + 1] || '';
            let chunk = chunk1 + chunk2;
            if (textarea.value.length + chunk.length < maxChars) {
                textarea.value += chunk;
                updateCharCount(newPost, textarea.value);
            } else {
                remainingChunks = chunks.slice(i);
                break;
            }
        }
        textarea.focus();
        let flowText = '';
        if (remainingChunks && remainingChunks.length > 0) {
            for (let c of remainingChunks) {
                flowText += c;
            }
            if (postItems.length > 0) {
                const addPostBtn = newPost.querySelector('.add-post-btn');
                currentPost = addPostBtn.parentElement;
            }
            if (flowText) {
                createNewPost(flowText.trim()).then((newPost) => {
                    splitIntoToots(
                        newPost,
                        flowText.trim(),
                        newPost.querySelector('.post-text')
                    );
                });
            }
        } else {
            let postCounters = postItems.map(function (p) {
                return p.getAttribute('counter');
            });
            updatePostList(
                'Updating list of posts after splitting',
                postCounters
            );
            textarea.focus();
        }
        isSplitting = false;
    }

    numberPostsCheckbox.addEventListener('change', async () => {
        let message = 'Updating post list after ticking/unticking checkbox';
        await updatePostList(message, oldPosts);
    });

    function updatePostCount() {
        for (let p of postItems) {
            const i = postItems.indexOf(p);
            const pNo = i + 1;
            const postCount = p.querySelector('.post-count');
            postCount.textContent = `Pouet ${pNo}/${postItems.length}`;
            p.setAttribute('counter', `${pNo}/${postItems.length}`);
        }
        return postItems.length;
    }

    let updateTime = 1;
    async function updatePostList(message, oldPosts, nbOfPosts) {
        if (!nbOfPosts) {
            nbOfPosts = postItems.length;
        } else {
        }
        let numberPosts = numberPostsCheckbox.checked;
        replyPreview.style.marginBottom = '10px';
        let threadLinks = Array.from(
            document.querySelectorAll('.thread-link')
        ).filter((t) => t.style.display === 'block');
        threadLinks.forEach((t) => t.remove());
        let times = 1;
        for (let p of postItems) {
            const i = postItems.indexOf(p);
            const previousPost = postItems[i - 1];
            if (previousPost) {
                let replyLink = threadLink.cloneNode(true);
                p.before(replyLink);
                previousPost.style.marginBottom = '0';
                replyLink.style.display = 'block';
            } else if (
                postItems.indexOf(p) === 0 &&
                previewDiv.style.display === 'flex'
            ) {
                let replyLink = threadLink.cloneNode(true);
                p.before(replyLink);
                replyPreview.style.marginBottom = '0';
                replyLink.style.display = 'block';
            }
            postItems[postItems.length - 1].style.marginBottom = '20px';
            const textarea = p.querySelector('textarea.post-text');
            let text = textarea.value;
            let oldCount;
            if (oldPosts && oldPosts.length > 0) {
                oldCount = oldPosts[i];
            } else {
                oldCount = `${i + 1}/${nbOfPosts}`;
            }
            times++;
            const postCount = `${i + 1}/${postItems.length}`;
            if (numberPosts) {
                if (oldCount && oldCount !== 'skip') {
                    if (text.startsWith(oldCount)) {
                        text = text.replace(oldCount, postCount);
                    } else {
                        text = `${postCount}\n${text}`;
                    }
                } else if (!oldCount || oldCount === 'skip') {
                    text = `${postCount}\n${text}`;
                }
                textarea.value = text;
                updateCharCount(p, textarea.value);
            } else if (!numberPosts) {
                if (postCount && text.startsWith(postCount)) {
                    text = text.replace(postCount, '').trim();
                    textarea.value = text;
                    updateCharCount(p, textarea.value);
                }
            }
        }
        updateTime++;
        postItems.forEach((p) => {
            const textarea = p.querySelector('textarea.post-text');
            textarea.focus();
        });
        return true;
    }

    let threadUrl;
    postThreadBtn.addEventListener('click', async () => {
        postThreadBtn.style.display = 'none';
        contentContainer.style.display = 'none';
        counter.style.display = 'block';
        counter.style.marginTop = '50px';
        let ok = await postThread();
        if (!ok) {
            spinner.style.display = 'none';
            counter.style.display = 'none';
            postThreadBtn.style.display = 'flex';
            contentContainer.style.display = 'flex';
            return;
        }
        spinner.remove();
        counter.textContent =
            'Votre fil a été publié. Pour fermer votre session (ordinateur partagé), cliquez sur « Réinitialiser ».';
        counter.style.color = '#563acc';
        const restartBtn = document.createElement('button');
        restartBtn.textContent = 'Composer un nouveau fil';
        restartBtn.style.marginTop = '50px';
        restartBtn.onclick = () => {
            location.reload(true);
        };
        counter.after(restartBtn);
        postThreadBtn.style.display = 'none';
        window.open(threadUrl, '_blank');
    });

    async function uploadMedia(f, d) {
        const formData = new FormData();
        formData.append('file', f);
        if (d) {
            formData.append('description', d);
        }

        try {
            const response = await fetch(`https://${instance}/api/v2/media`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    scope: 'write',
                },
                body: formData,
            });
            if (!response.ok) {
                if (response.status === 401) {
                    window.alert("Vous n'êtes pas authentifié.e");
                    return;
                }
                const errorData = await response.json();
                console.error('Error uploading media: ', errorData);
                window.alert(
                    `Un média n'a pas pu être envoyé : ${errorData.error}`
                );
                return;
            } else if (response.status === 202) {
                const data = await response.json();
                const id = data.id;
                let status = await getUploadStatus();
                async function getUploadStatus() {
                    let res = await fetch(
                        `https://${instance}/api/v1/media/${id}`,
                        {
                            headers: {
                                Authorization: `Bearer ${token}`,
                                scope: 'write',
                            },
                        }
                    );
                    if (res.status === 401) {
                        const errorData = await res.json();
                        console.error('Error checking media: ', errorData);
                        return;
                    }
                    return res.status;
                }
                while (!status || (status !== 200 && status !== 401)) {
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    status = await getUploadStatus();
                }
                if (status === 200) {
                    return id;
                } else {
                    console.error('Media upload status: ', status);
                    return;
                }
            } else if (response.status === 200) {
                const data = await response.json();
                const id = data.id;
                return id;
            }
        } catch (error) {
            console.error('Fetch error: ', error);
        }
    }

    async function postThread() {
        postThreadBtn.textContent = null;
        spinner.style.display = 'inline-flex';
        let replyToId;
        if (originalId) {
            replyToId = originalId;
        }
        for (let post of postItems) {
            const i = postItems.indexOf(post);
            counter.textContent = `Publication du pouet ${i + 1}/${
                postItems.length
            }...`;

            const langSelect = post.querySelector('.lang-select');
            const postLang = langSelect.value;

            const vizSelect = post.querySelector('.viz-select');
            const visibility = vizSelect.value;

            const cwTextArea = post.querySelector('.cw-text');
            let cwText;
            if (cwTextArea.value) {
                cwText = cwTextArea.value;
            }

            const textarea = post.querySelector('.post-text');
            const postText = textarea.value;

            const id = post.id.split('-')[1];
            const postMediaIds = [];
            const postMedia = mediaFiles[`mediaFiles${id}`];
            if (postMedia && postMedia.length > 0) {
                const mediaCounter = document.createElement('div');
                mediaCounter.classList.add('counter');
                counter.appendChild(mediaCounter);
                for (let media of postMedia) {
                    mediaCounter.textContent = `(Téléversement du média ${
                        postMedia.indexOf(media) + 1
                    }/${postMedia.length}...)`;
                    let mediaId = await uploadMedia(
                        media.file,
                        media.description
                    );
                    if (!mediaId) {
                        window.alert(`Un média n'a pas pu être attaché`);
                        return;
                    }
                    postMediaIds.push(mediaId);
                }
                mediaCounter.remove();
            }
            if (!postText && postMedia.length === 0) {
                if (i === 0) {
                    if (postItems.length === 1) {
                        window.alert('Le fil est vide');
                        return;
                    }
                    window.alert('Votre premier pouet ne peut pas être vide');
                    return;
                }
                continue;
            }
            try {
                const response = await fetch(
                    `https://${instance}/api/v1/statuses`,
                    {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json',
                            scope: 'write',
                        },
                        body: JSON.stringify({
                            status: postText,
                            media_ids: postMediaIds,
                            spoiler_text: cwText,
                            visibility: visibility,
                            in_reply_to_id: replyToId,
                            language: postLang,
                        }),
                    }
                );

                if (!response.ok) {
                    if (response.status === 401) {
                        window.alert("Vous n'êtes pas authentifié.e");
                        return;
                    }
                    const errorData = await response.json();
                    console.error('Error posting status: ', errorData);
                    window.alert(
                        `Le pouet n°${id} n'a pas pu être envoyé.\n${errorData.error}`
                    );
                    return;
                }
                const data = await response.json();
                replyToId = data.id;
                if (i === 0) {
                    threadUrl = data.url;
                }
            } catch (error) {
                console.error('Fetch error: ', error);
            }
        }
        return threadUrl;
    }
});
