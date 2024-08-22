document.addEventListener('DOMContentLoaded', async function () {
    const instructionsDiv = document.getElementById('instructions');
    const instanceInput = document.getElementById('instance-input');
    const instanceDataList = document.getElementById('inst-list');
    const instanceBtn = document.getElementById('instance-btn');
    const contentContainer = document.getElementById('content-container');
    const postItem = document.getElementById('post-item');
    const languageSelect = document.querySelector('.lang-select');
    const postThreadBtn = document.getElementById('post-thread-btn');
    const spinner = document.getElementById('spinner');
    const counter = document.getElementById('counter');

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
    let postItems = [];
    let mediaIds = {};
    let i = 0;

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
        await buildInstList();
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
            instanceInput.disabled = true;
            instructionsDiv.style.display = 'none';
            if (postItems.length === 0) {
                await getMax();
                await buildLangList();
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
            counter.style.display = 'none';
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
        } else {
            if (defaultViz === 'private') {
                vizSelect.value = defaultViz;
            } else {
                vizSelect.value = 'unlisted';
            }
        }

        vizSelect.addEventListener('change', () => {
            const newIndex = postItems.indexOf(newPost)
            if (newIndex === 0) {
                defaultViz = vizSelect.value;
                if (defaultViz === 'private') {
                    for (let p of postItems) {
                        const vizS = p.querySelector('.viz-select');
                        vizS.value = defaultViz;
                    }
                }
            }
        });

        const langSelect = newPost.querySelector('.lang-select');
        langSelect.value = lang;

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

        let files = [];
        mediaIds[`mediaIds${i}`] = [];

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

        newPost.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropzone.classList.remove('dz-active');
            overlay.style.display = 'none';
            dzInst.style.display = 'none';
            const newFiles = e.dataTransfer.files;
            if (files.length >= maxMedia) {
                window.alert("Le nombre maximum d'images est atteint.");
                return;
            } else {
                for (let f of newFiles) {
                    if (files.length < maxMedia) {
                        files.push(f);
                        const imgSpinnerDiv =
                            dropzone.querySelector('.img-spinner-div');
                        imgSpinnerDiv.style.display = 'flex';
                        let mediaId = await uploadMedia(f);
                        if (mediaId) {
                            mediaIds[`mediaIds${i}`].push(mediaId);
                            imgCount.textContent = `${files.length}/${maxMedia}`;
                            imgSpinnerDiv.style.display = 'none';
                        } else {
                            imgSpinnerDiv.style.display = 'none';
                            continue;
                        }
                        displayThumbnail(f, imgPreview, imgCount, dzInst);
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
                        files.push(f);
                        const imgSpinnerDiv =
                            dropzone.querySelector('.img-spinner-div');
                        imgSpinnerDiv.style.display = 'flex';
                        let mediaId = await uploadMedia(f);
                        if (mediaId) {
                            mediaIds[`mediaIds${i}`].push(mediaId);
                            imgCount.textContent = `${files.length}/${maxMedia}`;
                            imgSpinnerDiv.style.display = 'none';
                        } else {
                            imgSpinnerDiv.style.display = 'none';
                            continue;
                        }
                        displayThumbnail(f, imgPreview, imgCount, dzInst);
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
                removeBtn.textContent = '✖';
                removeBtn.classList.add('remove-btn');

                removeBtn.addEventListener('click', async () => {
                    const index = files.indexOf(file);
                    if (index > -1) {
                        files.splice(index, 1);
                        mediaIds[`mediaIds${i}`].splice(index, 1);
                    }
                    div.remove();
                    imgCount.textContent = `${files.length}/${maxMedia}`;
                    if (files.length === 0) {
                        dzInst.style.display = 'block';
                    }
                });

                div.appendChild(img);
                div.appendChild(removeBtn);
                imgPreview.appendChild(div);

                const altBtn = document.createElement('button');
                altBtn.textContent = 'ALT';
                altBtn.classList.add('alt-btn');
                const altDiv = imgPreview.querySelector('.alt-div');
                const newAltDiv = altDiv.cloneNode(true);
                const altTextArea = newAltDiv.querySelector('.alt-text');

                const altCounter = newAltDiv.querySelector('.alt-counter');
                altTextArea.addEventListener('input', () => {
                    altCounter.textContent = `${altTextArea.value.length}/1500`;
                    if (altTextArea.value.length > 0) {
                        altCancelBtn.textContent = 'Effacer';
                    } else if (altTextArea.value.length === 0) {
                        altCancelBtn.textContent = 'Annuler';
                    }
                    if (altTextArea.value.length > 1500) {
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
                        updateMedia(file, altText);
                        altBtn.style.color = '#009900';
                        newAltDiv.style.display = 'none';
                    } else if (e.key === 'Escape') {
                        newAltDiv.style.display = 'none';
                    }
                });

                const altSaveBtn = newAltDiv.querySelector('.alt-save-btn');
                const altCancelBtn = newAltDiv.querySelector('.alt-cancel-btn');
                altBtn.addEventListener('click', () => {
                    const altText = altTextArea.value;
                    if (altText) {
                        altCancelBtn.textContent = 'Effacer';
                    } else {
                        altCancelBtn.textContent = 'Annuler';
                    }
                    newAltDiv.style.display = 'flex';
                    altTextArea.focus();
                });
                altSaveBtn.addEventListener('click', async () => {
                    const altText = altTextArea.value;
                    await updateMedia(file, altText);
                    altBtn.style.color = '#009900';
                    newAltDiv.style.display = 'none';
                });
                altCancelBtn.addEventListener('click', async () => {
                    const altText = altTextArea.value;
                    if (altText.length > 0) {
                        altTextArea.value = null;
                        altCounter.textContent = '0/1500';
                        altCancelBtn.textContent = 'Annuler';
                    } else if (altText.length === 0) {
                        await updateMedia(file, altText);
                        altBtn.removeAttribute('style');
                        newAltDiv.style.display = 'none';
                    }
                });

                div.appendChild(altBtn);
                div.appendChild(newAltDiv);
            };
            reader.readAsDataURL(file);
        }

        async function uploadMedia(f) {
            const formData = new FormData();
            formData.append('file', f);

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
                        `Un média n'a pas pu être envoyé : ${errorData.error}`
                    );
                    return;
                }

                const data = await response.json();
                return data.id;
            } catch (error) {
                console.error('Fetch error: ', error);
            }
        }

        async function updateMedia(f, altText) {
            const formData = new FormData();
            formData.append('description', altText);

            let mediaIndex = files.indexOf(f);
            let mediaId = mediaIds[`mediaIds${i}`][mediaIndex];

            try {
                const response = await fetch(
                    `https://${instance}/api/v1/media/${mediaId}`,
                    {
                        method: 'PUT',
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                        body: formData,
                    }
                );
                if (!response.ok) {
                    const errorData = await response.json();
                    console.error('Error updating media: ', errorData);
                    window.alert(
                        `Erreur en mettant à jour le média ${mediaId}`
                    );
                    return;
                }
                const data = await response.json();
                return data.description;
            } catch (error) {
                console.error('Error fetching media update: ', error);
                return;
            }
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
        counter.style.marginTop = '50px';
        await postThread();
        spinner.remove();
        counter.textContent =
            'Votre fil a été publié. Pensez à cliquer sur « Réinitialiser » pour fermer votre session.';
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
            const postMedia = mediaIds[`mediaIds${id}`];
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
                            media_ids: postMedia,
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
