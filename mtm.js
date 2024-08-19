document.addEventListener('DOMContentLoaded', async function () {
    const instructionsDiv = document.getElementById('instructions');
    const instanceInput = document.getElementById('instance-input');
    const instanceBtn = document.getElementById('instance-btn');
    const contentContainer = document.getElementById('content-container');
    const postItem = document.getElementById('post-item');
    const postThreadBtn = document.getElementById('post-thread-btn');
    const spinner = document.getElementById('spinner');
    // const viewThreadBtn = document.getElementById('view-thread-btn');
    const counter = document.getElementById('counter');

    let maxChars;
    let maxMedia;
    let lang;
    let postItems = [];
    let files = {};

    let instance;
    checkInstance();
    let token;
    checkToken();

    window.onload = async function () {
        if (!token && instance) {
            const urlParams = new URLSearchParams(window.location.search);
            code = urlParams.get('code');
            if (code) {
                token = await exchangeCodeForToken(code);
                if (token) {
                    localStorage.setItem('mastothreadtoken', token);
                    checkToken();
                }
            }
        }
    };

    let clientId;
    let clientSecret;
    clientId = localStorage.getItem('mastothreadid');
    clientSecret = localStorage.getItem('mastothreadsecret');
    let code;

    function checkInstance() {
        instance = localStorage.getItem('mastothreadinstance');
        if (instance) {
            instanceInput.value = instance;
            instanceBtn.textContent = 'Réinitialiser';
            instanceInput.disabled = true;
        } else if (!instance) {
            instanceInput.value = null;
            instanceBtn.textContent = 'Valider';
            instanceInput.disabled = false;
        }
    }

    async function checkToken() {
        token = localStorage.getItem('mastothreadtoken');
        if (token) {
            instanceInput.value = instance + ' ✅';
            instructionsDiv.style.display = 'none';
            if (postItems.length === 0) {
                await getMax();
                createNewPost();
                postThreadBtn.style.display = 'flex';
            }
        } else if (!token) {
            instructionsDiv.style.display = 'block';
        }
    }

    function removeToken() {
        localStorage.removeItem('mastothreadtoken');
        localStorage.removeItem('mastothreadid');
        localStorage.removeItem('mastothreadsecret');
    }

    instanceInput.addEventListener('keydown', async (event) => {
        if (event.key === 'Enter') {
            instance = instanceInput.value;
            if (!instance) {
                window.alert('Veuillez indiquer votre instance Mastodon');
                return;
            }
            localStorage.setItem('mastothreadinstance', instance);
            removeToken();
            await createApp();
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
            removeToken();
            checkInstance();
            checkToken();
        } else {
            instance = instanceInput.value;
            if (!instance) {
                window.alert('Veuillez indiquer votre instance Mastodon');
                return;
            }
            localStorage.setItem('mastothreadinstance', instance);
            removeToken();
            await createApp();
            redirectToAuthServer();
            checkInstance();
            checkToken();
        }
    });

    const redirectUri = window.location.href.split('?')[0];
    async function createApp() {
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
                    scopes: 'write',
                    website: redirectUri,
                }),
            });
            if (!response.ok) {
                console.error('Error creating app: response ', response.status);
                return;
            }
            const data = await response.json();
            clientId = data.client_id;
            clientSecret = data.client_secret;
            localStorage.setItem('mastothreadid', clientId);
            localStorage.setItem('mastothreadsecret', clientSecret);
        } catch (error) {
            console.error('Error fetching: ', error);
        }
    }

    function redirectToAuthServer() {
        const scope = 'write';
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
    }

    let i = 0;
    let defaultViz = 'public';
    let currentPost;
    function createNewPost() {
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

        const vizSelect = newPost.querySelector('.viz-select');
        const index = postItems.indexOf(newPost);
        if (index === 0) {
            vizSelect.value = 'public';
            vizSelect.addEventListener('change', () => {
                defaultViz = vizSelect.value;
                if (defaultViz === 'private') {
                    for (let p of postItems) {
                        const vizS = p.querySelector('.viz-select');
                        vizS.value = defaultViz;
                    }
                }
            });
        } else {
            if (defaultViz === 'private') {
                vizSelect.value = defaultViz;
            } else {
                vizSelect.value = 'unlisted';
            }
        }

        const langSelect = newPost.querySelector('.lang-select');
        langSelect.value = lang;

        i++;
        newPost.id = 'post-' + i;
        files[`files${i}`] = [];
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

        updatePostCount();

        const textarea = newPost.querySelector('.post-text');
        textarea.value = null;
        textarea.focus();
        const charCount = newPost.querySelector('.char-count');
        charCount.textContent = `0/${maxChars}`;

        textarea.addEventListener('input', () => {
            const postText = textarea.value;
            charCount.textContent = `${postText.length}/${maxChars}`;
            if (postText.length > maxChars) {
                charCount.style.color = '#cc0000';
                charCount.style.fontWeight = 'bold';
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

        const imgCount = newPost.querySelector('.img-count');
        imgCount.textContent = `0/${maxMedia}`;

        const dropzone = newPost.querySelector('.dropzone');
        const dzInst = dropzone.querySelector('.dz-inst');
        const imgPreview = dropzone.querySelector('.img-preview');

        const overlay = newPost.querySelector('div.overlay');
        newPost.addEventListener('dragover', (e) => {
            e.preventDefault();
            overlay.style.display = 'flex';
        });

        newPost.addEventListener('dragleave', (e) => {
            e.preventDefault();
            overlay.style.display = 'none';
        });

        newPost.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dz-active');
            overlay.style.display = 'none';
            dzInst.style.display = 'none';
            const newFiles = e.dataTransfer.files;
            if (files[`files${i}`].length >= maxMedia) {
                window.alert("Le nombre maximum d'images est atteint.");
                return;
            } else {
                for (let f of newFiles) {
                    if (files[`files${i}`].length < maxMedia) {
                        files[`files${i}`].push(f);
                        displayThumbnail(f, imgPreview, imgCount, dzInst);
                        imgCount.textContent = `${
                            files[`files${i}`].length
                        }/${maxMedia}`;
                    } else {
                        window.alert("Le nombre maximum d'images est atteint");
                        break;
                    }
                }
            }
        });

        function displayThumbnail(file, imgPreview, imgCount, dzInst) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const div = document.createElement('div');
                const img = document.createElement('img');
                const removeBtn = document.createElement('button');

                img.src = e.target.result;
                removeBtn.textContent = 'X';
                removeBtn.classList.add('remove-btn');

                removeBtn.addEventListener('click', () => {
                    const index = files[`files${i}`].indexOf(file);
                    if (index > -1) {
                        files[`files${i}`].splice(index, 1);
                    }
                    div.remove();
                    imgCount.textContent = `${
                        files[`files${i}`].length
                    }/${maxMedia}`;
                    if (files[`files${i}`].length === 0) {
                        dzInst.style.display = 'block';
                    }
                });

                div.appendChild(img);
                div.appendChild(removeBtn);
                imgPreview.appendChild(div);
            };
            reader.readAsDataURL(file);
        }

        const deletePostBtn = newPost.querySelector('.delete-post-btn');
        deletePostBtn.addEventListener('click', () => {
            const index = postItems.indexOf(newPost);
            if (postItems.length > 1) {
                const id = newPost.id.split('-')[1];
                postItems.splice(index, 1);
                newPost.remove();
                delete files[`files${id}`];
                updatePostCount();
                if (postItems.length === 1) {
                    const post = postItems[0];
                    const delBtn = post.querySelector('.delete-post-btn');
                    delBtn.style.display = 'none';
                }
            }
            const firstPost = postItems[0];
            const firstVizSelect = firstPost.querySelector('.viz-select');
            firstVizSelect.value = defaultViz;
        });
    }

    function updatePostCount() {
        for (let p of postItems) {
            const i = postItems.indexOf(p);
            const pNo = i + 1;
            const postCount = p.querySelector('.post-count');
            postCount.textContent = `Pouet ${pNo}/${postItems.length}`;
        }
    }

    let threadUrl;
    postThreadBtn.addEventListener('click', async () => {
        postThreadBtn.style.display = 'none';
        contentContainer.remove();
        counter.style.display = 'block';
        await postThread();
        spinner.remove();
        counter.remove();
        postThreadBtn.style.display = 'none';
        // viewThreadBtn.addEventListener('click', () => {
            window.location.href = threadUrl;
        // });
        // viewThreadBtn.style.display = 'flex';
    });

    async function postThread() {
        postThreadBtn.textContent = null;
        spinner.style.display = 'inline-flex';
        let replyToId;
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
            const media = files[`files${id}`];
            let mediaIds = [];
            if (media) {
                for (let m of media) {
                    const formData = new FormData();
                    formData.append('file', m);

                    try {
                        const response = await fetch(
                            `https://${instance}/api/v2/media`,
                            {
                                method: 'POST',
                                headers: {
                                    Authorization: `Bearer ${token}`,
                                    scope: 'write',
                                },
                                body: formData,
                            }
                        );

                        if (!response.ok) {
                            const errorData = await response.json();
                            console.error('Error uploading media: ', errorData);
                            window.alert(
                                `Un fichier attaché au pouet n°${id} n'a pas pu être envoyé`
                            );
                            return;
                        }

                        const data = await response.json();
                        mediaIds.push(data.id);
                    } catch (error) {
                        console.error('Fetch error: ', error);
                    }
                }
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
                            media_ids: mediaIds,
                            spoiler_text: cwText,
                            visibility: visibility,
                            in_reply_to_id: replyToId,
                            language: postLang,
                        }),
                    }
                );

                if (!response.ok) {
                    const errorData = await response.json();
                    console.error('Error posting status: ', errorData);
                    window.alert(`Le pouet n°${id} n'a pas pu être envoyé.`);
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
    }
});
