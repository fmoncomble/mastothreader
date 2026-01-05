import { franc } from 'https://esm.sh/franc@6?bundle';
import { iso6393 } from 'https://esm.sh/iso-639-3@3?bundle';
import { getNativeName } from 'https://esm.sh/iso-639-1@3?bundle';
import muxjs from 'https://esm.sh/mux.js@6.3.0';

const waitingDialog = document.getElementById('waiting_dialog');
const waitingSpinner = waitingDialog.querySelector('div.spinner');
waitingSpinner.style.display = 'flex';

waitingDialog.showModal();

document.addEventListener('DOMContentLoaded', async function () {
	// Declare page elements
	const instructionsBtn = document.getElementById('instructions-btn');
	const instructionsDiv = document.getElementById('instructions');
	const instanceInput = document.getElementById('instance-input');
	const instanceBtn = document.getElementById('instance-btn');
	const clearStorage = document.getElementById('clear-storage');
	const openOptionsBtn = document.getElementById('open-options');
	const optionsDiv = document.getElementById('options-container');
	const scheduleCheckbox = document.getElementById(
		'schedule-thread-checkbox'
	);
	scheduleCheckbox.checked = false;
	const scheduleInput = document.getElementById('schedule-input');
	scheduleInput.value = null;
	const contentContainer = document.getElementById('content-container');
	const importSelect = document.querySelector('select.import');
	const bskyResetBtn = document.getElementById('bsky-reset');
	const numberPostsDiv = document.getElementById('number-posts-div');
	const numberPostsCheckbox = document.getElementById('number-posts');
	numberPostsCheckbox.checked = false;
	const inReplyToDiv = document.getElementById('in-reply-to');
	const inReplyToInput = document.getElementById('in-reply-input');
	inReplyToInput.value = null;
	const replyPreview = document.getElementById('reply-preview');
	const previewDiv = document.getElementById('replied-post-preview');
	const threadLink = document.getElementById('thread-link');
	const postItem = document.getElementById('post-item');
	const languageSelect = document.querySelector('.lang-select');
	const postThreadBtn = document.getElementById('post-thread-btn');
	const spinner = document.getElementById('spinner');
	const counter = document.getElementById('counter');
	const bskyAuthDialog = document.getElementById('bsky-auth-dialog');
	const idInput = document.getElementById('id-input');
	const pwdInput = document.getElementById('pwd-input');
	const submitBtn = document.getElementById('bsky-login-btn');
	const cancelBskyLoginBtn = document.getElementById('bsky-cancel-btn');
	const bskyThreadDialog = document.getElementById('bsky-thread-dialog');
	const bskyThreadInput = document.getElementById('bsky-thread-input');
	bskyThreadInput.value = null;
	const bskyThreadOk = document.getElementById('bsky-thread-ok');
	const bskyThreadCancel = document.getElementById('bsky-thread-cancel');
	const convertHandlesCheckbox = document.getElementById('convert-handles');
	const wpImportDialog = document.getElementById('wp-import-dialog');
	const wpUrlInput = document.getElementById('wp-url-input');
	wpUrlInput.value = null;
	const wpImportOk = document.getElementById('wp-import-ok');
	const wpImportCancel = document.getElementById('wp-import-cancel');
	const bskyLoadingSpinner = document.getElementById('bsky-loading-dialog');

	const yearSpan = document.querySelector('span#year');
	yearSpan.textContent = new Date().toISOString().split('-')[0];

	// Clear local storage
	clearStorage.addEventListener('click', () => {
		let instance = localStorage.getItem('mastothreadinstance');
		localStorage.removeItem('mastothreadinstance');
		localStorage.removeItem('mastothreadtoken-v2');
		localStorage.removeItem(`${instance}-id-v2`);
		localStorage.removeItem(`${instance}-secret-v2`);
		localStorage.removeItem('bsky-did');
		localStorage.removeItem('bsky-handle');
		window.location.reload();
	});

	// Declare localisation variables
	const uiLang = navigator.language.split('-')[0].toLowerCase();
	let locData;

	// Declare authentication variables
	let instance;
	const redirectUri = window.location.href.split('?')[0];
	let clientId;
	let clientSecret;
	let code;
	let token;

	// Declare Mastodon instance & user variables
	let mediaConfig = {};
	let maxChars;
	let maxMedia;
	let pollOptions;
	let reservedChars;
	let lang;
	let customEmoji;
	let userAvatarSrc;

	// Declare post variables
	let defaultViz = 'public';
	let defaultQuote = 'public';
	let splitNb = 0;
	let isSplitting = false;
	let postItems = [];
	let originalId;
	let originalUser;
	let updateTime = 1;
	let currentPost;
	let mediaFiles = {};
	let polls = {};
	let quotedStatuses = {};
	let oldPosts = [];
	let i = 0;

	// Declare import variables
	let mastoText = null;
	let inReplyUrl = null;
	let userId = null;
	let userName = null;
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
	let bskyUrl = null;
	let convertHandles = false;
	let fromBsky = false;
	let bskyLink = null;
	let bskyPosts = [];
	let WPUrl = null;
	let fromWP = false;
	let wpChunks = [];

	// Localise UI
	await localiseUI();

	// Handle Mastodon instance and authentication
	checkInstance();
	checkCredentials();
	if (instance) {
		localStorage.removeItem(`${instance}-id`);
		localStorage.removeItem(`${instance}-secret`);
	}
	localStorage.removeItem('mastothreadtoken');
	await checkToken();

	// Function to handle replied-to post
	const getRepliedToPost = debounce(async (e) => {
		try {
			const inReplyToUrl = e
				? e.target.value.trim()
				: inReplyToInput.value.trim();
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
				updateCharCount(firstPostItem, textarea.value, textarea);
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
				updateCharCount(firstPostItem, textarea.value, textarea);
				createRepliedPostPreview(data.statuses[0]);
				textarea.focus();
			}
		} catch (error) {
			console.error(error);
		}
	}, 200);

	// Checking for URL search parameters
	const urlParams = new URLSearchParams(window.location.search);
	if (urlParams.has('bsky_url')) {
		bskyUrl = urlParams.get('bsky_url');
	}
	if (urlParams.has('wp_url')) {
		WPUrl = urlParams.get('wp_url');
	}
	if (urlParams.has('user_id')) {
		let originUserId = urlParams.get('user_id');
		if (userId && originUserId !== userId) {
			if (window.confirm(locData['user-confirm'])) {
				instanceInput.value = null;
				instanceInput.disabled = false;
				instanceBtn.textContent = locData['instance-btn'];
				localStorage.removeItem('mastothreadinstance');
				instanceInput.value = null;
				counter.style.display = 'none';
				await removeToken();
				window.location.reload();
			} else {
				userId = null;
			}
			checkCredentials();
		}
	}
	if (urlParams.has('instance')) {
		let originInstance = urlParams.get('instance');
		if (instance && originInstance !== instance) {
			if (window.confirm(locData['instance-confirm'])) {
				instanceInput.value = null;
				instanceInput.disabled = false;
				instanceBtn.textContent = locData['instance-btn'];
				localStorage.removeItem('mastothreadinstance');
				instanceInput.value = null;
				counter.style.display = 'none';
				await removeToken();
				window.location.reload();
			} else {
				userId = null;
			}
			checkCredentials();
		}
	}
	if (urlParams.has('reply_to')) {
		inReplyUrl = urlParams.get('reply_to');
	}
	if (urlParams.has('text')) {
		mastoText = urlParams.get('text');
	}
	if (!token && instance) {
		code = urlParams.get('code');
		if (code) {
			token = await exchangeCodeForToken(code);
			if (token) {
				localStorage.setItem('mastothreadtoken-v2', token);
				await checkToken();
				bskyLink = sessionStorage.getItem('bsky_url') || null;
				WPUrl = sessionStorage.getItem('wp_url') || null;
				mastoText = sessionStorage.getItem('text') || null;
				inReplyUrl = sessionStorage.getItem('reply_to') || null;
				userId = sessionStorage.getItem('user_id') || null;
				const newParams = new URLSearchParams();
				bskyLink ? newParams.append('bsky_url', bskyLink) : null;
				WPUrl ? newParams.append('wp_url', WPUrl) : null;
				mastoText ? newParams.append('text', mastoText) : null;
				inReplyUrl ? newParams.append('reply_to', inReplyUrl) : null;
				userId ? newParams.append('user_id', userId) : null;
				const newUrl = `${redirectUri}?${newParams.toString()}`;
				sessionStorage.clear();
				if (newParams.toString()) {
					window.location.replace(newUrl);
				} else {
					window.location.replace(redirectUri);
				}
				await checkScheduledPosts();
				customEmoji = await getCustomEmoji(instance);
				waitingDialog.close();
				if (bskyLink || inReplyUrl || WPUrl) {
					optionsDiv.style.display = 'flex';
				}
				if (bskyLink) {
					if (window.confirm(locData['bsky-confirm'])) {
						if (
							window.confirm(locData['convert-handles-confirm'])
						) {
							convertHandles = true;
						}
						await getBskyThread();
					}
				} else if (inReplyUrl) {
					inReplyToInput.value = inReplyUrl;
					getRepliedToPost();
				} else if (WPUrl) {
					if (window.confirm(locData['wp-confirm'])) {
						await getWPPost(WPUrl);
					}
				}
			}
		}
	} else if (!token) {
		for (let [key, value] of urlParams) {
			sessionStorage.setItem(key, value);
		}
		window.alert(locData['instance-warning']);
		instanceInput.focus();
	} else if (token) {
		await checkScheduledPosts();
		customEmoji = await getCustomEmoji(instance);
		waitingDialog.close();
		if (bskyUrl) {
			if (window.confirm(locData['bsky-confirm'])) {
				if (window.confirm(locData['convert-handles-confirm'])) {
					convertHandles = true;
				}
				bskyLink = bskyUrl;
				await getBskyThread();
			}
		}
		if (WPUrl) {
			if (window.confirm(locData['wp-confirm'])) {
				await getWPPost(WPUrl);
			}
		}
		if (inReplyUrl) {
			inReplyToInput.value = inReplyUrl;
			getRepliedToPost();
		}
	}

	// Localizing function
	async function localiseUI() {
		let locFile = await fetch(`${uiLang}.json`);
		if (!locFile.ok) {
			locFile = await fetch('en.json');
		}
		locData = await locFile.json();
		document.querySelectorAll('[data-lang]').forEach((element) => {
			const key = element.getAttribute('data-lang');
			element.innerHTML = locData[key];
		});
		document.querySelectorAll('[placeholder-lang]').forEach((element) => {
			const key = element.getAttribute('placeholder-lang');
			element.placeholder = locData[key];
		});
	}

	// Handle instructions display
	instructionsBtn.addEventListener('click', () => {
		if (instructionsDiv.style.display === 'none') {
			instructionsDiv.style.display = 'flex';
			instructionsBtn.textContent = locData['instructions-hide'];
		} else {
			instructionsDiv.style.display = 'none';
			instructionsBtn.textContent = locData['instructions-btn'];
		}
	});

	// Functions to gather instance information
	let instanceList = document.getElementById('instance-list');
	instanceList.style.left = `${instanceInput.offsetLeft}px`;

	instanceInput.addEventListener('input', async (e) => {
		e.preventDefault();
		let input = e.target.value;
		buildInstList(input.toLowerCase());
	});

	const buildInstList = debounce(async (input) => {
		if (!input) {
			instanceList.style.display = 'none';
			return;
		}
		const matches = await searchInstance(input);
		if (matches && matches.length > 0) {
			instanceList.innerHTML = null;
			instanceList.style.display = 'block';
			for (let m of matches) {
				const instItem = document.createElement('div');
				instItem.classList.add('instance-item');
				const instName = document.createElement('span');
				instName.textContent = m;
				instItem.appendChild(instName);
				instItem.addEventListener('click', () => {
					instanceInput.value = m;
					instanceList.style.display = 'none';
					instanceBtn.click();
				});
				instanceList.appendChild(instItem);
			}
			instanceList
				.querySelector('.instance-item')
				.classList.add('selected');
		} else {
			instanceList.innerHTML = null;
			instanceList.style.display = 'none';
		}
	}, 200);

	function debounce(callback, delay) {
		let timer;
		return function (...args) {
			clearTimeout(timer);
			timer = setTimeout(() => callback(...args), delay);
		};
	}

	async function searchInstance(input) {
		try {
			let res = await fetch('inst.php?input=' + input);
			if (res.ok) {
				let matches = [];
				let data = await res.json();
				let instances = data.instances
					.filter((i) => i.dead === false)
					.sort((a, b) => a.name.localeCompare(b.name));
				let results = instances.filter((i) => i.name.startsWith(input));
				for (let r of results) {
					matches.push(r.name);
				}
				return matches;
			}
		} catch (error) {
			console.error('Error fetching instances: ', error);
		}
	}
	let instIndex = 0;
	instanceInput.addEventListener('keydown', (e) => {
		let instanceItems = instanceList.querySelectorAll('.instance-item');
		let currentInst = instanceItems[instIndex];
		if (instanceItems && instanceItems.length > 0) {
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				if (instIndex < instanceItems.length - 1) {
					instIndex++;
					let oldInst = instanceItems[instIndex - 1];
					currentInst = instanceItems[instIndex];
					if (oldInst) {
						oldInst.classList.remove('selected');
					}
					if (currentInst) {
						currentInst.classList.add('selected');
						instanceInput.value =
							currentInst.querySelector('span').textContent;
					}
				}
			} else if (e.key === 'ArrowUp') {
				e.preventDefault();
				if (instIndex > 0) {
					instIndex--;
					let oldInst = instanceItems[instIndex + 1];
					currentInst = instanceItems[instIndex];
					if (oldInst) {
						oldInst.classList.remove('selected');
					}
					if (currentInst) {
						currentInst.classList.add('selected');
						instanceInput.value =
							currentInst.querySelector('span').textContent;
					}
				}
			} else if (e.key === 'Escape') {
				e.preventDefault();
				instanceList.style.display = 'none';
			} else if (e.key === 'Tab' || e.key === 'Enter') {
				e.preventDefault();
				currentInst = instanceList.querySelector('.selected');
				if (currentInst) {
					instanceInput.value =
						currentInst.querySelector('span').textContent;
					instanceList.style.display = 'none';
				}
			}
		}
	});

	async function buildLangList() {
		const langDataUrl = `https://${instance}/api/v1/instance/languages`;
		try {
			let res = await fetch(langDataUrl);
			if (res.ok) {
				let data = await res.json();
				for (let lang of data) {
					let nativeName = getNativeName(lang.code);
					if (nativeName) {
						lang.native_name = nativeName;
					} else {
						continue;
					}
				}
				data.sort((a, b) => a.name.localeCompare(b.name));
				for (let lang of data) {
					const langValue = lang.code;
					const langName = lang.name;
					const nativeName = lang.native_name;
					const option = document.createElement('option');
					option.value = langValue;
					option.textContent = langName;
					if (nativeName) {
						option.textContent = `${nativeName} (${langName})`;
					} else {
						continue;
					}
					languageSelect.appendChild(option);
				}
			}
		} catch (error) {
			console.error('Error fetching languages: ', error);
		}
	}

	// Handle plugin download link
	const pluginDl = document.getElementById('plugin-dl');
	if (window.screen.width < 600) {
		pluginDl.style.display = 'none';
	}
	const dlPic = document.getElementById('dl-pic');
	const dlMsg = document.getElementById('dl-msg');
	const pluginInstall = document.getElementById('plugin-install');
	const pluginLink = document.createElement('a');
	pluginLink.textContent = locData['plugin-install'];
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
		pluginInstall.textContent = locData['plugin-install-unavailable'];
	} else {
		pluginInstall.textContent = locData['plugin-install-unavailable'];
	}
	dlPic.onclick = () => {
		if (dlMsg.style.display === 'none') {
			dlMsg.style.display = 'flex';
		} else {
			dlMsg.style.display = 'none';
		}
	};

	async function checkApp() {
		let res = await fetch(
			`https://${instance}/api/v1/apps/verify_credentials`,
			{
				headers: { Authorization: `Bearer ${token}` },
			}
		);
		if (!res.ok) {
			const error = await res.json();
			window.alert(locData['app-warning'] + `\n` + error.error + '.');
			await removeToken();
			window.location.reload();
			return false;
		} else {
			return true;
		}
	}

	async function getUserId() {
		let res = await fetch(`https://${instance}/oauth/userinfo`, {
			headers: { Authorization: `Bearer ${token}` },
		});
		if (!res.ok) {
			console.error('Error fetching user info');
			window.alert(locData['user-info-error']);
			await removeToken();
			localStorage.removeItem('mastothreadtoken-v2');
			localStorage.removeItem(`${instance}-id-v2`);
			localStorage.removeItem(`${instance}-secret-v2`);
			window.location.reload();
			return;
		} else {
			let data = await res.json();
			userName = data.preferred_username;
			userAvatarSrc = data.picture;
			let idRes = await fetch(
				`https://${instance}/api/v1/accounts/lookup?acct=${data.preferred_username}`
			);
			if (!idRes.ok) {
				console.error('Error fetching user ID');
			} else {
				let idData = await idRes.json();
				userId = idData.id;
			}
		}
	}

	function checkCredentials() {
		clientId = localStorage.getItem(`${instance}-id-v2`);
		clientSecret = localStorage.getItem(`${instance}-secret-v2`);
	}

	function checkInstance() {
		instance = localStorage.getItem('mastothreadinstance');
		if (instance) {
			instanceInput.value = instance;
		} else if (!instance) {
			instanceInput.value = null;
		}
	}

	async function checkToken() {
		token = localStorage.getItem('mastothreadtoken-v2');
		if (token) {
			instanceInput.value = instance + ' ✅';
			instanceInput.disabled = true;
			instanceBtn.textContent = locData['instance-reset'];
			instructionsDiv.style.display = 'none';
			instructionsBtn.textContent = locData['instructions-btn'];
			openOptionsBtn.style.display = 'flex';
			clearStorage.style.display = 'none';
			const ok = await checkApp();
			if (!ok) {
				return;
			}
			await getUserId();
			document.getElementById('instance-text-input').style.display =
				'none';
			document.getElementById('logged-in-as').textContent =
				locData['logged-in-as'] + ` @${userName}@${instance} ✅`;
			document.getElementById('logged-in-as').style.display = 'flex';
			if (postItems.length === 0) {
				await getMax();
				await buildLangList();
				mastoText = new URLSearchParams(window.location.search).get(
					'text'
				);
				createNewPost(mastoText ? mastoText : null);
				postThreadBtn.style.display = 'flex';
				// waitingDialog.close();
			}
		} else if (!token) {
			instructionsDiv.style.display = 'flex';
			instructionsBtn.textContent = locData['instructions-hide'];
			instanceBtn.textContent = locData['instance-btn'];
			clearStorage.style.display = 'block';
			openOptionsBtn.style.display = 'none';
			waitingDialog.close();
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
				locData['reset-warning'] + `\n` + error.error_description
			);
		}
	}

	instanceInput.addEventListener('keydown', async (event) => {
		if (event.key === 'Enter') {
			instance = instanceInput.value;
			if (!instance) {
				window.alert(locData['instance-empty']);
				return;
			}
			localStorage.setItem('mastothreadinstance', instance);
			checkCredentials();
			if (!clientId && !clientSecret) {
				await createMastoApp();
			}
			redirectToAuthServer();
		}
	});

	instanceBtn.addEventListener('click', async () => {
		if (instanceInput.disabled) {
			instanceInput.value = null;
			instanceInput.disabled = false;
			instanceBtn.textContent = locData['instance-btn'];
			localStorage.removeItem('mastothreadinstance');
			instanceInput.value = null;
			counter.style.display = 'none';
			await removeToken();
			window.location.href = window.location.href.split('?')[0];
		} else {
			instance = instanceInput.value;
			if (!instance) {
				window.alert(locData['instance-empty']);
				return;
			}
			if (instance.includes('@')) {
				instance = instance.split('@')[1];
			}
			localStorage.setItem('mastothreadinstance', instance);
			checkCredentials();
			if (!clientId && !clientSecret) {
				await createMastoApp();
			}
			redirectToAuthServer();
		}
	});

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
					scopes: 'profile read write',
					website: redirectUri,
				}),
			});
			if (!response.ok) {
				if (response.status === 429) {
					window.alert(locData['server-busy']);
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
		const scope = 'profile read write';
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

	// Collect Mastodon instance info
	async function getMax() {
		const response = await fetch(`https://${instance}/api/v1/instance`);
		if (!response.ok) {
			console.error('Could not fetch instance');
			return;
		}
		const data = await response.json();
		maxChars = Number(data.configuration.statuses.max_characters);
		maxMedia = Number(data.configuration.statuses.max_media_attachments);
		reservedChars = Number(
			data.configuration.statuses.characters_reserved_per_url
		);
		pollOptions = data.configuration.polls;
		lang = data.languages[0];
		mediaConfig = data.configuration.media_attachments;
	}
	async function getCustomEmoji(instance) {
		const response = await fetch(
			`https://${instance}/api/v1/custom_emojis`
		);
		if (!response.ok) {
			console.error('Could not fetch custom emojis');
			return;
		}
		const data = await response.json();
		const emojiArray = [];
		for (let d of data) {
			let dCat;
			if (d.category) {
				dCat = `${instance} ${d.category.toLowerCase()}`;
			} else {
				dCat = 'Custom';
			}
			if (!emojiArray.find((c) => c.id === dCat.toLowerCase())) {
				let category = {};
				category.id = dCat.toLowerCase();
				category.name = d.category ? d.category : 'Custom';
				category.emojis = [];
				emojiArray.push(category);
			}
			let emoji = {};
			emoji.id = d.shortcode;
			emoji.name = d.shortcode;
			emoji.keywords = [dCat.toLowerCase()];
			emoji.skins = [{ src: d.url }];
			emoji.native = `:${d.shortcode}:`;
			emojiArray
				.find((c) => c.id === dCat.toLowerCase())
				.emojis.push(emoji);
		}
		emojiArray.sort((a, b) => a.id.localeCompare(b.id));
		return emojiArray;
	}

	// Handle showing/hiding options
	openOptionsBtn.addEventListener('click', () => {
		if (optionsDiv.style.display !== 'flex') {
			optionsDiv.style.display = 'flex';
			openOptionsBtn.textContent = locData['close-options'];
		} else {
			optionsDiv.style.display = 'none';
			openOptionsBtn.textContent = locData['open-options'];
		}
	});

	// Handle scheduling option
	scheduleCheckbox.addEventListener('change', () => {
		if (scheduleCheckbox.checked) {
			const now = new Date();
			const offset = now.getTimezoneOffset();
			const minDate = new Date(
				now.setMinutes(now.getMinutes() - offset + 5)
			);
			scheduleInput.setAttribute(
				'min',
				minDate.toISOString().slice(0, 16)
			);
			scheduleInput.value = minDate.toISOString().slice(0, 16);
			scheduleInput.style.display = 'flex';
		} else {
			scheduleInput.value = null;
			scheduleInput.style.display = 'none';
		}
	});
	scheduleInput.addEventListener('change', () => {
		if (scheduleInput.value) {
			console.log(
				'Schedule date: ',
				new Date(scheduleInput.value).toISOString()
			);
		} else {
			console.log('No schedule date selected');
		}
	});

	// Check for scheduled posts
	async function checkScheduledPosts() {
		try {
			let res = await fetch(
				`https://${instance}/api/v1/scheduled_statuses`,
				{
					headers: {
						Authorization: `Bearer ${token}`,
					},
				}
			);
			if (!res.ok) {
				console.error('Error fetching scheduled posts: ', res.status);
				return;
			}
			let data = await res.json();
			if (data.length) {
				const scheduledList = document.getElementById('scheduled-list');
				for (let status of data) {
					const option = document.createElement('option');
					option.value = status.id;
					option.textContent =
						status.params.text.substring(0, 20) + '...';
					scheduledList.appendChild(option);
				}
				const cancelScheduleBtn = document.getElementById(
					'cancel-schedule-btn'
				);
				cancelScheduleBtn.addEventListener('click', async () => {
					const selectedOption =
						scheduledList.options[scheduledList.selectedIndex];
					const statusId = scheduledList.value;
					if (statusId) {
						await cancelScheduledPost(
							statusId,
							selectedOption,
							cancelScheduleBtn
						);
					}
				});
				const cancelSchedule =
					document.getElementById('cancel-schedule');
				cancelSchedule.style.display = 'flex';
			}
		} catch (error) {
			console.error('Error fetching scheduled posts: ', error);
		}
	}

	async function cancelScheduledPost(id, option, button) {
		try {
			let res = await fetch(
				`https://${instance}/api/v1/scheduled_statuses/${id}`,
				{
					method: 'DELETE',
					headers: {
						Authorization: `Bearer ${token}`,
					},
				}
			);
			if (!res.ok) {
				console.error('Error cancelling scheduled post: ', res.status);
				return;
			} else {
				button.style.backgroundColor = 'green';
				button.textContent = '✔︎';
				setTimeout(() => {
					option.remove();
					if (
						document.getElementById('scheduled-list').options
							.length === 0
					) {
						const cancelSchedule =
							document.getElementById('cancel-schedule');
						cancelSchedule.style.display = 'none';
					}
				}, 1000);
			}
		} catch (error) {
			console.error('Error cancelling scheduled post: ', error);
		}
	}

	// Handle post creation in reply to another post
	inReplyToInput.addEventListener('input', async (e) => {
		getRepliedToPost(e);
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
			updateCharCount(firstPostItem, textarea.value, textarea);
			let message = 'Updating post list after clearing in-reply-to';
			updatePostList(message);
		};

		optionsDiv.style.display = 'flex';
		openOptionsBtn.textContent = locData['close-options'];
		previewDiv.style.display = 'flex';
		let message = 'Updating post list after setting in-reply-to';
		updatePostList(message);
	}

	function updateCharCount(post, postText, textarea) {
		const charCount = post.querySelector('.char-count');
		let postLength = postText.trim().length;
		const handleRegexp =
			/(^|\s)@([a-zA-Z0-9_]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
		const handleMatches = postText.match(handleRegexp);
		if (handleMatches && handleMatches.length) {
			for (let handle of handleMatches) {
				let index = handle.lastIndexOf('@');
				postLength -= handle.length - index;
			}
		}
		const urlRegexp = /https?:\/\/[^\s]+/g;
		const urlMatches = postText.match(urlRegexp);
		if (urlMatches && urlMatches.length) {
			for (let url of urlMatches) {
				postLength -= url.length - reservedChars;
			}
		}
		charCount.textContent = `${postLength}/${maxChars}`;
		if (postLength >= maxChars - 20 && postLength < maxChars) {
			charCount.removeAttribute('style');
			charCount.style.color = '#ff9900';
			charCount.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: #ff9900;"></i> ${postLength}/${maxChars}`;
		} else if (postLength >= maxChars) {
			charCount.style.color = '#cc0000';
			charCount.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: #cc0000;"></i> ${postLength}/${maxChars}`;
			splitIntoToots(post, postText, textarea);
		} else {
			charCount.removeAttribute('style');
		}
	}

	// Handle imports
	bskyResetBtn.addEventListener('click', () => {
		bskyDid = null;
		bskyHandle = null;
		localStorage.removeItem('bsky-did');
		localStorage.removeItem('bsky-handle');
		bskyLink = null;
		bskyThreadInput.value = null;
		bskyResetBtn.style.display = 'none';
	});

	cancelBskyLoginBtn.addEventListener('click', () => {
		importSelect.value = '0';
		bskyAuthDialog.close();
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
				window.alert(locData['bsky-rate-warning'] + timeString);
				bskyAuthDialog.close();
				return;
			}
			window.alert(`${locData['auth-error']} ${errorData.message}`);
			bskyAuthDialog.close();
			return;
		}
	});

	importSelect.value = '0';

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
			importSelect.value = '0';
			bskyLink = null;
			bskyThreadInput.value = null;
			bskyThreadDialog.close();
		}
	});
	bskyThreadCancel.addEventListener('click', () => {
		importSelect.value = '0';
		bskyLink = null;
		bskyThreadInput.value = null;
		bskyThreadDialog.close();
	});

	wpImportOk.addEventListener('click', async () => {
		let url = wpUrlInput.value;
		WPUrl = await resolveWPUrl(url);
		if (WPUrl) {
			getWPPost(WPUrl);
			wpImportDialog.close();
		} else {
			window.alert(locData['wp-invalid']);
			wpUrlInput.value = null;
			importSelect.value = '0';
			wpImportDialog.close();
		}
	});
	wpImportCancel.addEventListener('click', () => {
		importSelect.value = '0';
		WPUrl = null;
		wpUrlInput.value = null;
		wpImportDialog.close();
	});
	wpUrlInput.addEventListener('keydown', async (event) => {
		if (event.key === 'Enter') {
			wpImportOk.click();
		} else if (event.key === 'Escape') {
			wpImportCancel.click();
		}
	});

	async function resolveWPUrl(WPUrl) {
		if (!WPUrl.startsWith('http')) {
			return;
		}
		try {
			const url = new URL(WPUrl);
			const domain = url.hostname;
			const path = url.pathname.replace(/\/$/, '');
			const pathSegments = path.split('/');
			const slug = pathSegments.pop();
			const apiLink = `https://public-api.wordpress.com/rest/v1.1/sites/${domain}/posts/slug:${slug}`;
			const res = await fetch(apiLink);
			if (res.ok) {
				return apiLink;
			} else {
				const searchTerm = encodeURIComponent(
					slug.replaceAll('-', ' ')
				);
				const searchUrl = `https://${domain}/wp-json/wp/v2/search?search=${searchTerm}&type=post`;
				const res = await fetch(searchUrl);
				if (res.ok) {
					const data = await res.json();
					if (data.length > 0) {
						const postId = data[0].id;
						const postApiLink = `https://${domain}/wp-json/wp/v2/posts/${postId}`;
						return postApiLink;
					} else {
						return null;
					}
				} else {
					return null;
				}
			}
		} catch (error) {
			return null;
		}
	}

	importSelect.addEventListener('change', async () => {
		if (importSelect.value === 'bsky') {
			if (!bskyDid) {
				bskyAuthDialog.showModal();
			} else if (bskyDid && bskyHandle) {
				bskyThreadInput.value = null;
				bskyThreadDialog.showModal();
			}
		} else if (importSelect.value === 'wp') {
			wpImportDialog.showModal();
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

	// Handle import of Bluesky thread
	async function getBskyThread() {
		if (!bskyDid || !bskyHandle) {
			if (window.confirm(locData['bsky-warning'])) {
				bskyDid = null;
				bskyHandle = null;
				localStorage.removeItem('bsky-did');
				localStorage.removeItem('bsky-handle');
				bskyAuthDialog.showModal();
				return;
			} else {
				bskyLink = null;
				importSelect.value = '0';
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
				window.alert(locData['bsky-invalid']);
				bskyLink = null;
				importSelect.value = '0';
				bskyLoadingSpinner.close();
				return;
			}
			let handle = pathname.split('/')[2];
			if (
				(handle.startsWith('did:plc:') && handle !== bskyDid) ||
				(!handle.startsWith('did:plc:') && handle !== bskyHandle)
			) {
				if (window.confirm(locData['bsky-author-warning'])) {
					bskyDid = null;
					bskyHandle = null;
					localStorage.removeItem('bsky-did');
					localStorage.removeItem('bsky-handle');
					bskyAuthDialog.showModal();
					return;
				} else {
					bskyLink = null;
					importSelect.value = '0';
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
						bskyLoadingText.textContent = `${locData['bsky-thread-text']} ${index}/${bskyPosts.length}...`;
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
													`@${acct} `
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
							const facets = p.record.facets;
							if (facets && facets.length > 0) {
								const links = facets.filter(
									(f) =>
										f.features[0].$type ===
										'app.bsky.richtext.facet#link'
								);
								for (let l of links) {
									const uri = l.features[0].uri;
									const startIndex = l.index.byteStart;
									const endIndex = l.index.byteEnd;
									const encoder = new TextEncoder();
									const textBytes = encoder.encode(text);
									const link = textBytes.slice(
										startIndex,
										endIndex
									);
									const uriBytes = encoder.encode(uri);
									const newTextBytes = new Uint8Array(
										textBytes.length -
											link.length +
											uriBytes.length
									);
									newTextBytes.set(
										textBytes.slice(0, startIndex)
									);
									newTextBytes.set(uriBytes, startIndex);
									newTextBytes.set(
										textBytes.slice(endIndex),
										startIndex + uriBytes.length
									);
									const newText = new TextDecoder().decode(
										newTextBytes
									);
									text = newText;
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
										} else if (!text.includes(cardUrl)) {
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
					window.alert(locData['bsky-error']);
					bskyLink = null;
					importSelect.value = '0';
					fromBsky = false;
					bskyLoadingSpinner.close();
					return;
				}
			} else {
				window.alert(locData['bsky-error']);
				bskyLink = null;
				importSelect.value = '0';
				fromBsky = false;
				bskyLoadingSpinner.close();
				return;
			}
			bskyLoadingSpinner.close();
			postItems[0].querySelector('.post-text').focus();
			window.scrollTo(0, 0);
			await new Promise((resolve) => setTimeout(resolve, 0));
			window.alert(locData['thread-ready']);
		} else {
			importSelect.value = '0';
		}
	}

	// Handle import of WordPress blogpost
	async function getWPPost(WPUrl) {
		bskyLoadingSpinner.showModal();
		const WPloadingText = document.getElementById('bsky-loading-text');
		WPloadingText.textContent = locData['wp-loading-text'];
		fromWP = true;
		let res = await fetch(WPUrl);
		if (!res || !res.ok) {
			window.alert(locData['wp-error']);
			bskyLoadingSpinner.close();
			return;
		}
		let data = await res.json();
		let content = data.content.rendered;
		if (!content) {
			content = data.content;
		}
		let postLink = data.link || data.URL;
		const parser = new DOMParser();
		const doc = parser.parseFromString(content, 'text/html');
		const body = doc.body;
		const elements = Array.from(
			body.querySelectorAll(
				'h1, h2, h3, h4, h5, h6, p, li, img, video, iframe'
			)
		);

		let index = 0;
		let chunk = { text: '', media: [] };

		while (elements && elements.length > 0 && index < elements.length) {
			let e = elements[index];
			if (e.textContent && e.textContent.length > 0) {
				if (e.parentElement.tagName === 'BLOCKQUOTE') {
					e.textContent = `“${e.textContent}”`;
				}
				if (e.tagName === 'LI') {
					e.textContent = `• ${e.textContent}`;
				}
				const links = e.querySelectorAll('a');
				if (links.length > 0) {
					for (let l of links) {
						const url = l.getAttribute('href');
						if (
							url &&
							url.startsWith('http') &&
							url !== l.textContent
						) {
							l.textContent += ` (${url})`;
						}
					}
				}
				if (wpChunks.length === 0 && chunk.text.length === 0) {
					chunk.text += e.textContent.trim();
				} else if (chunk.media.length > 0) {
					wpChunks.push(chunk);
					chunk = { text: '', media: [] };
					chunk.text += e.textContent.trim();
				} else if (chunk.text.length === 0) {
					chunk.text += e.textContent.trim();
				} else {
					if (e.tagName.includes('H')) {
						wpChunks.push(chunk);
						chunk = { text: '', media: [] };
						chunk.text += e.textContent.trim();
					} else {
						chunk.text += `\n\n${e.textContent.trim()}`;
					}
				}
				index++;
			} else if (e.tagName === 'IMG' || e.tagName === 'VIDEO') {
				if (chunk.media.length < maxMedia) {
					let media = {
						type: e.tagName.toLowerCase(),
						url: e.src,
						alt:
							e.alt || e.getAttribute('data-image-title') || null,
					};
					chunk.media.push(media);
				} else {
					wpChunks.push(chunk);
					chunk = { text: '', media: [] };
					let media = {
						type: e.tagName.toLowerCase(),
						url: e.src,
						alt: e.alt || null,
					};
					chunk.media.push(media);
				}
				index++;
			} else if (e.tagName === 'IFRAME' && e.src.includes('youtube')) {
				const ytEmbedElts = e.src.split('/');
				const embed = ytEmbedElts.find((e) => e === 'embed');
				if (embed) {
					const ytID =
						ytEmbedElts[ytEmbedElts.indexOf(embed) + 1].split(
							'?'
						)[0];
					const ytLink = `https://www.youtube.com/watch?v=${ytID}`;
					chunk.text += `\n\n${ytLink}`;
				}
				index++;
			} else {
				index++;
			}
		}
		wpChunks.push(chunk);

		async function splitText(chunk) {
			return new Promise(async (resolve) => {
				let text = chunk.text.trim();
				let newChunk = { text: '', media: [] };
				let segments = [];
				if (text) {
					const regex = /([,.;:!?"”»]\s)/gu;
					segments = text.split(regex);
				}
				let oldText = '';
				for (let i = 0; i < segments.length; i += 1) {
					let segment = segments[i];
					let oldTextLength = oldText.length;
					let segmentLength = segment.trim().length;
					const urlRegexp = /https?:\/\/[^\s]+/g;
					const urlMatchesInOldText = segment.match(urlRegexp);
					if (urlMatchesInOldText && urlMatchesInOldText.length > 0) {
						for (let url of urlMatchesInOldText) {
							oldTextLength -= url.length - reservedChars;
						}
					}
					const urlMatchesInSegment = segment.match(urlRegexp);
					if (urlMatchesInSegment && urlMatchesInSegment.length > 0) {
						for (let url of urlMatchesInSegment) {
							segmentLength -= url.length - reservedChars;
						}
					}
					if (oldTextLength + segmentLength <= maxChars) {
						oldText += segment;
					} else {
						chunk.text = oldText.trim();
						let remainingSegments = segments.slice(i);
						let remainingText = remainingSegments.join('');
						if (remainingText) {
							newChunk.text = remainingText.trim();
							if (wpChunks.indexOf(chunk) > 0) {
								newChunk.media = chunk.media;
								chunk.media = [];
							}
							wpChunks.splice(
								wpChunks.indexOf(chunk) + 1,
								0,
								newChunk
							);
							break;
						}
						break;
					}
				}
				resolve(newChunk);
			});
		}

		for (let p of wpChunks) {
			if (p.text) {
				p.text = p.text.trim();
				let pTextLength = p.text.length;
				const urlRegexp = /https?:\/\/[^\s]+/g;
				const urlMatches = p.text.match(urlRegexp);
				if (urlMatches && urlMatches.length > 0) {
					for (let url of urlMatches) {
						pTextLength -= url.length - reservedChars;
					}
				}
				if (pTextLength > maxChars) {
					await splitText(p);
				}
			}
		}

		if (postItems && postItems.length > 0) {
			postItems[0].remove();
		}
		postItems = [];
		for (let p of wpChunks) {
			try {
				WPloadingText.textContent = `${locData['creating-toot']} ${
					wpChunks.indexOf(p) + 1
				}/${wpChunks.length}...`;
				if (p.media.length > 0) {
					const mediaCounter = document.createElement('div');
					mediaCounter.classList.add('bsky-loading-text');
					mediaCounter.textContent = `${locData['wp-media']}: ${p.media.length}`;
					WPloadingText.appendChild(mediaCounter);
				}
				await createNewPost(p.text, p.media);
				currentPost = postItems[wpChunks.indexOf(p)];
			} catch (error) {
				console.error(
					`Error creating post ${wpChunks.indexOf(p) + 1}: `,
					error
				);
			}
		}
		let finalPostText = `${locData['final-post-text']} ${postLink}`;
		createNewPost(finalPostText);
		bskyLoadingSpinner.close();
		postItems[0].querySelector('.post-text').focus();
		window.scrollTo(0, 0);
		await new Promise((resolve) => setTimeout(resolve, 0));
		window.alert(locData['thread-ready']);
	}

	// Create new post
	async function createNewPost(text, imgs) {
		oldPosts = postItems.map(function (p) {
			return p.getAttribute('counter');
		});
		const newPost = postItem.cloneNode(true);
		const addPostBtn = newPost.querySelector('.add-post-btn');
		if (postItems.length === 0) {
			contentContainer.appendChild(newPost);
			postItems.push(newPost);
		} else if (currentPost) {
			if (scheduleCheckbox.checked) {
				window.alert(locData['schedule-warning']);
				return;
			}
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

		const addPoll = newPost.querySelector('.add-poll');
		const pollContainer = newPost.querySelector('.poll-container');
		const imgUpload = newPost.querySelector('input.img-upload');
		const addImg = newPost.querySelector('button.add-img');

		const vizSelect = newPost.querySelector('.viz-select');
		const vizList = newPost.querySelector('.viz-list');
		const vizItems = vizList.querySelectorAll('.viz-item');

		const quoteSelect = newPost.querySelector('.quote-select');
		const quoteList = newPost.querySelector('.quote-list');
		const quoteItems = quoteList.querySelectorAll('.quote-item');

		vizSelect.addEventListener('click', () => {
			vizList.style.display =
				vizList.style.display === 'flex' ? 'none' : 'flex';
			document.addEventListener('click', function outsideClick(event) {
				if (
					!vizSelect.contains(event.target) &&
					!vizList.contains(event.target)
				) {
					vizList.style.display = 'none';
					document.removeEventListener('click', outsideClick);
				}
			});
		});
		vizSelect.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				vizList.style.display = 'none';
			}
		});
		const vizClasses = {
			public: 'fa-solid fa-earth-europe',
			unlisted: 'fa-solid fa-moon',
			private: 'fa-solid fa-lock',
			direct: 'fa-solid fa-at',
		};
		vizItems.forEach((item) => {
			item.addEventListener('click', () => {
				const dataValue = item.getAttribute('data-value');
				if (dataValue === 'private' || dataValue === 'direct') {
					defaultQuote = 'nobody';
					quoteItems.forEach((it) => {
						if (
							it.getAttribute('data-value') === 'public' ||
							it.getAttribute('data-value') === 'followers'
						) {
							it.removeAttribute('style');
							it.classList.add('disabled');
							it.querySelector('i').style.color = 'gray';
						} else if (it.getAttribute('data-value') === 'nobody') {
							it.style.fontWeight = 'bold';
						}
					});
					quoteSelect.setAttribute('data-value', 'nobody');
					quoteSelect.innerHTML = `<i
						class="${quoteClasses['nobody']}"
						></i
					>`;
					for (let p of postItems) {
						const quoteS = p.querySelector('.quote-select');
						quoteS.setAttribute('data-value', 'nobody');
						quoteS.innerHTML = `<i
								class="${quoteClasses['nobody']}"
								></i>`;
						const pQuoteList = p.querySelector('.quote-list');
						const pQuoteItems =
							pQuoteList.querySelectorAll('.quote-item');
						pQuoteItems.forEach((it) => {
							it.removeAttribute('style');
							if (it.getAttribute('data-value') === 'nobody') {
								it.style.fontWeight = 'bold';
							}
						});
					}
				} else {
					quoteItems.forEach((it) => {
						it.classList.remove('disabled');
						it.querySelector('i').style.color = '#563acc';
					});
				}
				vizSelect.setAttribute('data-value', dataValue);
				vizSelect.innerHTML = `<i
					class="${vizClasses[dataValue]}"
					></i
				>`;
				const newIndex = postItems.indexOf(newPost);
				if (newIndex === 0) {
					defaultViz = dataValue;
					if (defaultViz !== 'public') {
						for (let p of postItems) {
							const vizS = p.querySelector('.viz-select');
							vizS.setAttribute('data-value', defaultViz);
							vizS.innerHTML = `<i
								class="${vizClasses[defaultViz]}"
								></i>`;
							const pVizList = p.querySelector('.viz-list');
							const pVizItems =
								pVizList.querySelectorAll('.viz-item');
							pVizItems.forEach((it) => {
								it.removeAttribute('style');
								if (
									it.getAttribute('data-value') === defaultViz
								) {
									it.style.fontWeight = 'bold';
								}
							});
						}
					}
				}
				vizItems.forEach((it) => {
					it.removeAttribute('style');
				});
				item.style.fontWeight = 'bold';
				vizList.style.display = 'none';
			});
		});

		const index = postItems.indexOf(newPost);
		if (index === 0) {
			vizSelect.setAttribute('data-value', 'public');
			vizSelect.innerHTML = `<i
									class="fa-solid fa-earth-europe"
									></i
								>`;
		} else {
			if (defaultViz !== 'public') {
				vizSelect.setAttribute('data-value', defaultViz);
				vizSelect.innerHTML = `<i
									class="${vizClasses[defaultViz]}"
									></i
								>`;
			} else {
				vizSelect.setAttribute('data-value', 'unlisted');
				vizSelect.innerHTML = `<i
									class="fa-solid fa-moon"
									></i
								>`;
			}
		}
		vizItems.forEach((it) => {
			it.removeAttribute('style');
			if (
				it.getAttribute('data-value') ===
				vizSelect.getAttribute('data-value')
			) {
				it.style.fontWeight = 'bold';
			}
		});

		const quoteClasses = {
			public: 'fa-solid fa-quote-left',
			followers: 'fa-solid fa-single-quote-left',
			nobody: 'fa-solid fa-comment-slash',
		};
		quoteSelect.addEventListener('click', () => {
			quoteList.style.display =
				quoteList.style.display === 'flex' ? 'none' : 'flex';
			document.addEventListener(
				'click',
				function outsideQuoteClick(event) {
					if (
						!quoteSelect.contains(event.target) &&
						!quoteList.contains(event.target)
					) {
						quoteList.style.display = 'none';
						document.removeEventListener(
							'click',
							outsideQuoteClick
						);
					}
				}
			);
		});
		quoteSelect.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				quoteList.style.display = 'none';
			}
		});
		quoteItems.forEach((item) => {
			item.addEventListener('click', () => {
				if (item.classList.contains('disabled')) {
					return;
				}
				const quoteValue = item.getAttribute('data-value');
				quoteSelect.setAttribute('data-value', quoteValue);
				quoteSelect.innerHTML = `<i
					class="${quoteClasses[quoteValue]}"
					></i
				>`;
				const newIndex = postItems.indexOf(newPost);
				if (newIndex === 0) {
					defaultQuote = quoteValue;
					if (defaultQuote !== 'public') {
						for (let p of postItems) {
							const quoteS = p.querySelector('.quote-select');
							quoteS.setAttribute('data-value', defaultQuote);
							quoteS.innerHTML = `<i
								class="${quoteClasses[defaultQuote]}"
								></i>`;
							const pQuoteList = p.querySelector('.quote-list');
							const pQuoteItems =
								pQuoteList.querySelectorAll('.quote-item');
							pQuoteItems.forEach((it) => {
								it.removeAttribute('style');
								if (
									it.getAttribute('data-value') ===
									defaultQuote
								) {
									it.style.fontWeight = 'bold';
								}
							});
						}
					}
				}
				quoteItems.forEach((it) => {
					it.removeAttribute('style');
				});
				item.style.fontWeight = 'bold';
				quoteList.style.display = 'none';
			});
		});
		if (index === 0) {
			quoteSelect.setAttribute('data-value', 'public');
			quoteSelect.innerHTML = `<i
									class="fa-solid fa-quote-left"
									></i
								>`;
		} else {
			if (defaultQuote !== 'public') {
				quoteSelect.setAttribute('data-value', defaultQuote);
				quoteSelect.innerHTML = `<i
									class="${quoteClasses[defaultQuote]}"
									></i
								>`;
			} else {
				quoteSelect.setAttribute('data-value', 'public');
				quoteSelect.innerHTML = `<i
									class="fa-solid fa-quote-left"
									></i
								>`;
			}
		}
		quoteItems.forEach((it) => {
			it.removeAttribute('style');
			if (
				it.getAttribute('data-value') ===
				quoteSelect.getAttribute('data-value')
			) {
				it.style.fontWeight = 'bold';
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

		newPost.style.display = 'flex';
		addPostBtn.addEventListener('click', () => {
			if (postItems.length > 0) {
				currentPost = addPostBtn.closest('.post-item');
			}
			createNewPost();
		});

		const charCount = newPost.querySelector('.char-count');
		charCount.textContent = `0/${maxChars}`;

		const textarea = newPost.querySelector('.post-text');
		textarea.style.minHeight = Number((maxChars / 50) * 20) + 'px';
		if (text) {
			text = text.trim();
			textarea.value = text;
			if (text.length > 30) {
				let language = franc(text);
				if (language === 'und') {
					language = lang;
				} else {
					let guess = iso6393.find(
						(l) => l.iso6393 === language
					).iso6391;
					if (guess) {
						lang = guess;
						langSelect.value = lang;
					}
				}
				updateCharCount(newPost, text, textarea);
				textarea.focus();
			}
		} else {
			textarea.value = null;
			textarea.focus();
		}
		if (originalUser && postItems.indexOf(newPost) === 0) {
			updateCharCount(newPost, textarea.value, textarea);
		}

		const emojiBtn = newPost.querySelector('.emoji-btn');
		emojiBtn.addEventListener('click', async () => {
			const customCategories = customEmoji.map((c) => c.id);
			const categories = [
				'frequent',
				...customCategories,
				'people',
				'nature',
				'foods',
				'activity',
				'places',
				'objects',
				'symbols',
				'flags',
			];
			let options = {
				custom: customEmoji,
				categories: categories,
				onEmojiSelect: function (emoji) {
					let e = emoji.native ? emoji.native : emoji.shortcodes;
					let curPos = textarea.selectionStart;
					let text = textarea.value;
					textarea.value =
						text.slice(0, curPos) + e + text.slice(curPos);
					textarea.focus();
					updateCharCount(newPost, textarea.value, textarea);
					picker.remove();
				},
				onClickOutside: function (e) {
					if (!emojiBtn.contains(e.target)) {
						picker.remove();
					}
				},
				previewPosition: 'none',
			};
			const picker = new EmojiMart.Picker(options);
			picker.classList.add('emoji-picker');
			window.onkeydown = (e) => {
				if (e.key === 'Escape') {
					picker.remove();
				}
			};
			newPost.appendChild(picker);
		});

		async function getMention(getInput) {
			let mention = '';
			let start = textarea.selectionStart - 1;
			let suggestions = [];
			textarea.removeEventListener('input', getInput);
			textarea.addEventListener('keydown', keyDown);
			let followingList;
			if (!document.getElementById('following-list')) {
				followingList = document.createElement('div');
			} else {
				followingList = document.getElementById('following-list');
			}
			followingList.id = 'following-list';
			followingList.classList.add('following-list');
			let choices;
			let currentChoice;
			let i = 0;
			function keyDown(e) {
				if (e.key === 'Escape') {
					e.preventDefault();
					followingList.remove();
				}
				if (e.key === 'ArrowDown') {
					e.preventDefault();
					if (i < choices.length - 1) {
						i++;
						let oldChoice = choices[i - 1];
						currentChoice = choices[i];
						if (oldChoice) {
							oldChoice.classList.remove('selected');
						}
						if (currentChoice) {
							currentChoice.classList.add('selected');
						}
					}
				} else if (e.key === 'ArrowUp') {
					e.preventDefault();
					if (i > 0) {
						i--;
						let oldChoice = choices[i + 1];
						currentChoice = choices[i];
						if (oldChoice) {
							oldChoice.classList.remove('selected');
						}
						if (currentChoice) {
							currentChoice.classList.add('selected');
						}
					}
				}
				if (e.key === 'Enter' || e.key === 'Tab') {
					e.preventDefault();
					let acct = currentChoice.querySelector('.acct').textContent;
					textarea.value =
						textarea.value.slice(0, start) +
						acct +
						textarea.value.slice(textarea.selectionEnd) +
						' ';
					followingList.remove();
					mention = '';
					textarea.removeEventListener('input', buildMention);
					textarea.removeEventListener('keydown', keyDown);
					textarea.addEventListener('input', getInput);
					updateCharCount(newPost, textarea.value, textarea);
					textarea.focus();
				}
			}
			textarea.addEventListener('input', buildMention);
			let fetching = false;
			async function buildMention(e) {
				e.preventDefault();
				i = 0;
				let AtMention = textarea.value.slice(
					start,
					textarea.selectionStart
				);
				if (e.data !== null) {
					mention += e.data;
				} else {
					mention = mention.slice(0, -1);
					if (AtMention.length === 0 || textarea.value.length === 0) {
						mention = '';
						followingList.remove();
						textarea.removeEventListener('input', buildMention);
						textarea.removeEventListener('keydown', keyDown);
						textarea.addEventListener('input', getInput);
						textarea.focus();
					}
				}
				if (e.data === ' ') {
					followingList.remove();
					mention = '';
					textarea.removeEventListener('input', buildMention);
					textarea.removeEventListener('keydown', keyDown);
					textarea.addEventListener('input', getInput);
					textarea.focus();
				}
				let mentionBuffer = '';
				if (mention.length > 1 && fetching) {
					await new Promise((resolve) => setTimeout(resolve, 200));
					mentionBuffer = new String(mention);
					buildSuggestionsList(mentionBuffer);
				} else if (mention.length > 1 && !fetching) {
					buildSuggestionsList(mention);
				} else if (mention.length < 2) {
					followingList.remove();
					fetching = false;
				}
				async function buildSuggestionsList(mention) {
					if (mention.length < mentionBuffer.length) {
						return;
					}
					fetching = true;
					let res = await fetch(
						`https://${instance}/api/v1/accounts/search?q=${mention}&type=accounts&limit=4`,
						{ headers: { Authorization: `Bearer ${token}` } }
					);
					if (res.ok) {
						let accounts = await res.json();
						suggestions = [];
						followingList.innerHTML = '';
						if (accounts.length > 0) {
							for (let a of accounts) {
								if (
									!suggestions.find((f) => f.acct === a.acct)
								) {
									suggestions.push({
										username: a.username,
										acct: a.acct,
										avatar: a.avatar,
									});
								}
							}
						}
						if (suggestions.length > 0) {
							for (let a of suggestions) {
								let fDiv = document.createElement('div');
								fDiv.classList.add('following-item');
								let avatar = document.createElement('img');
								avatar.src = a.avatar;
								fDiv.appendChild(avatar);
								let username = document.createElement('span');
								username.classList.add('username');
								username.textContent = `${a.username}`;
								let acct = document.createElement('span');
								acct.classList.add('acct');
								acct.textContent = `@${a.acct}`;
								fDiv.appendChild(username);
								fDiv.appendChild(acct);
								followingList.appendChild(fDiv);
							}
							followingList.style.display = 'block';
							textarea.after(followingList);
							let listDivs = Array.from(
								followingList.querySelectorAll('div')
							);
							for (let d of listDivs) {
								d.onclick = () => {
									let acct =
										d.querySelector(
											'span.acct'
										).textContent;
									textarea.value =
										textarea.value.slice(0, start) +
										acct +
										textarea.value.slice(
											textarea.selectionEnd
										) +
										' ';
									followingList.remove();
									mention = '';
									textarea.removeEventListener(
										'input',
										buildMention
									);
									textarea.removeEventListener(
										'keydown',
										keyDown
									);
									textarea.addEventListener(
										'input',
										getInput
									);
									updateCharCount(
										newPost,
										textarea.value,
										textarea
									);
									textarea.focus();
								};
							}
							choices =
								followingList.querySelectorAll(
									'div.following-item'
								);
							if (choices.length > 0) {
								choices.forEach((c) => {
									c.classList.remove('selected');
								});
								currentChoice = choices[0];
								currentChoice.classList.add('selected');
							} else if (choices.length === 0) {
								followingList.remove();
							}
						} else if (suggestions.length === 0) {
							followingList.remove();
						}
						fetching = false;
					}
				}
			}
		}
		let quote = false;
		let quoteUrls = new Set();
		let quoteUrl = null;
		textarea.addEventListener('input', getInput);
		async function getInput(e) {
			if (e.data === '@') {
				await getMention(getInput);
			}
			let postText = textarea.value;
			if (postText.length > 30) {
				let language = franc(postText);
				if (language === 'und') {
					language = lang;
				} else {
					let guess = iso6393.find(
						(l) => l.iso6393 === language
					).iso6391;
					if (guess) {
						lang = guess;
						langSelect.value = lang;
					}
				}
			}
			if (quoteUrl && !postText.includes(quoteUrl)) {
				quoteUrls.delete(quoteUrl);
				quoteUrl = null;
			}
			const id = newPost.id.split('-')[1];
			if (
				!quoteUrl &&
				!quote &&
				!mediaFiles[`mediaFiles${id}`].length &&
				!polls[`polls${id}`]
			) {
				const urlRegexp = /https?:\/\/[^\s]+/g;
				const urlMatches = postText.match(urlRegexp);
				if (urlMatches && urlMatches.length > 0) {
					let thisUrl = urlMatches[urlMatches.length - 1];
					if (quoteUrls.has(thisUrl)) {
						return;
					}
					const quotePreview =
						newPost.querySelector('.quote-preview');
					quotePreview.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
					quotePreview.style.height = '200px';
					quotePreview.style.display = 'flex';
					const quoteSpinner =
						quotePreview.querySelector('.quote-spinner');
					quoteSpinner.style.display = 'flex';
					let quotedStatus = await getQuoteStatus(thisUrl);
					quotedStatus ? (quote = true) : (quote = false);
					if (quotedStatus) {
						quote = true;
						quoteUrl = thisUrl;
						quoteUrls.add(quoteUrl);
						let quotedStatusApproval =
							quotedStatus.quote_approval.current_user;
						if (quotedStatusApproval === 'automatic') {
							quotedStatusApproval =
								quotedStatus.quote_approval.automatic[0];
						}
						if (
							quotedStatusApproval === 'denied' ||
							quotedStatusApproval === 'manual' ||
							quotedStatusApproval === 'unknown'
						) {
							quote = false;
							quoteSpinner.style.display = 'none';
							quotePreview.style.backgroundColor = 'transparent';
							quotePreview.style.height = 'auto';
							quotePreview.style.display = 'none';
							return;
						} else if (quotedStatusApproval === 'followers') {
							try {
								let res = await fetch(
									`https://${instance}/api/v1/accounts/relationships?id[]=${quotedStatus.account.id}`,
									{
										headers: {
											Authorization: `Bearer ${token}`,
										},
									}
								);
								if (res.ok) {
									let data = await res.json();
									if (!data[0].following) {
										quote = false;
										quoteSpinner.style.display = 'none';
										quotePreview.style.backgroundColor =
											'transparent';
										quotePreview.style.height = 'auto';
										quotePreview.style.display = 'none';
										return;
									}
								}
							} catch (error) {
								console.error(
									'Error checking followers: ',
									error
								);
								quote = false;
								return;
							}
						}
						const quotedStatusId = quotedStatus.id;
						quotedStatuses[`quotedStatuses${id}`] = quotedStatusId;
						addImg.disabled = true;
						addGif.disabled = true;
						addPoll.disabled = true;
						const quotePostPreview = quotePreview.querySelector(
							'.quote-post-preview'
						);
						const quotePostAvatar =
							quotePreview.querySelector('.quote-post-avatar');
						const quotePostDisplayName = quotePreview.querySelector(
							'.quote-post-display-name'
						);
						const quotePostTime =
							quotePreview.querySelector('.quote-post-time');
						const quotePostText =
							quotePreview.querySelector('.quote-post-text');
						const quotePostMedia =
							quotePreview.querySelector('.quote-post-media');
						const avatar = document.createElement('img');
						avatar.src = quotedStatus.account.avatar;
						avatar.alt = quotedStatus.account.display_name;
						quotePostAvatar.innerHTML = '';
						quotePostAvatar.appendChild(avatar);
						const name = document.createElement('span');
						name.textContent = quotedStatus.account.display_name;
						quotePostDisplayName.innerHTML = '';
						quotePostDisplayName.appendChild(name);
						const time = document.createElement('time');
						time.textContent = new Date(
							quotedStatus.created_at
						).toLocaleString();
						quotePostTime.innerHTML = '';
						quotePostTime.appendChild(time);
						const quoteText = quotedStatus.content;
						quotePostText.innerHTML = quoteText;
						const media = quotedStatus.media_attachments;
						quotePostMedia.innerHTML = '';
						for (let m of media) {
							const img = document.createElement('img');
							img.src = m.preview_url;
							img.alt = m.description ? m.description : '';
							quotePostMedia.appendChild(img);
						}
						quoteSpinner.style.display = 'none';
						quotePreview.style.backgroundColor = 'transparent';
						quotePreview.style.height = 'auto';
						quotePostPreview.style.display = 'flex';
						const quoteCloseBtn = quotePreview.querySelector(
							'.quote-preview-close'
						);
						quoteCloseBtn.onclick = () => {
							quotePreview.style.display = 'none';
							quotePostPreview.style.display = 'none';
							quote = false;
							delete quotedStatuses[`quotedStatuses${id}`];
							addImg.disabled = false;
							addGif.disabled = false;
							addPoll.disabled = false;
						};
					}
				}
			}
			updateCharCount(newPost, postText, textarea);
		}

		async function getQuoteStatus(url) {
			let searchUrl = `https://${instance}/api/v2/search?q=${encodeURIComponent(
				url
			)}&type=statuses&resolve=true&limit=2`;
			try {
				let res = await fetch(searchUrl, {
					headers: { Authorization: `Bearer ${token}` },
				});
				if (!res.ok) {
					return null;
				}
				let data = await res.json();
				if (data.statuses && data.statuses.length > 0) {
					let status = data.statuses[0];
					if (status) {
						return status;
					}
				} else {
					return null;
				}
			} catch (error) {
				console.error('Error fetching quote status: ', error);
				return null;
			}
		}

		textarea.addEventListener('focus', async () => {
			let postText = textarea.value;
			updateCharCount(newPost, postText, textarea);
		});

		const cwDiv = newPost.querySelector('.cw-div');
		const cwText = newPost.querySelector('.cw-text');
		const cwBtn = newPost.querySelector('.cw-btn');
		cwBtn.addEventListener('click', () => {
			if (cwDiv.style.display === 'none') {
				cwDiv.style.display = 'inline-flex';
				cwBtn.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: #ffffff;"></i>`;
				cwBtn.style.backgroundColor = '#563acc';
				cwBtn.title = "Supprimer l'avertissement";
				cwText.focus();
			} else {
				cwText.value = null;
				cwDiv.style.display = 'none';
				cwBtn.removeAttribute('style');
				cwBtn.title = 'Ajouter un avertissement';
				cwBtn.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i>`;
			}
		});

		// Handle media attachments
		mediaFiles[`mediaFiles${i}`] = [];
		let files = mediaFiles[`mediaFiles${i}`];

		const imgCount = newPost.querySelector('.img-count');
		imgCount.textContent = `0/${maxMedia}`;

		const dropzone = newPost.querySelector('.dropzone');
		const imgPreview = dropzone.querySelector('.img-preview');

		// Get Bluesky embedded media
		if (fromBsky && imgs && imgs.length > 0) {
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
					displayThumbnail(mediaFile, imgPreview, imgCount);
				} else if (img.type === 'image') {
					const form = new FormData();
					form.append('url', img.url);
					fetch('proxy.php', {
						method: 'POST',
						body: form,
					})
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
							displayThumbnail(mediaFile, imgPreview, imgCount);
						})
						.catch((error) =>
							console.error('Error fetching image:', error)
						);
				}
			}
		}

		// Get WP media
		if (fromWP && imgs && imgs.length > 0) {
			for (let img of imgs) {
				if (img.type === 'img') {
					let res = await getWPMedia(img);
					if (!res[0]) {
						continue;
					}
					let blob = await res[0].blob();
					const file = new File([blob], 'image.jpg', {
						type: blob.type,
					});
					let mediaFile = {};
					mediaFile.file = file;
					mediaFile.url = img.url;
					if (!img.alt) {
						mediaFile.description = res[1];
					} else {
						mediaFile.description = img.alt;
					}
					files.push(mediaFile);
					displayThumbnail(mediaFile, imgPreview, imgCount);
				} else if (img.type === 'video') {
					let mediaFile = {};
					mediaFile.url = img.url;
					mediaFile.type = img.type;
					mediaFile.description = img.alt;
					let res = await getWPMedia(img);
					if (!res[0]) {
						continue;
					}
					let blob = await res[0].blob();
					if (!img.alt) {
						mediaFile.description = res[1];
					}
					const file = new File([blob], 'video.mp4', {
						type: blob.type,
					});
					mediaFile.file = file;
					files.push(mediaFile);
					displayThumbnail(mediaFile, imgPreview, imgCount);
				}
			}
		}

		async function getWPMedia(img) {
			return new Promise(async (resolve) => {
				let mediaAlt = null;
				if (!img.alt) {
					let urlSegments = WPUrl.split('/').slice(0, -2);
					let baseUrl = urlSegments.join('/') + '/media/';
					let searchTerm = img.url.split('/').pop().split('?')[0];
					let searchUrl = `${baseUrl}?search=${searchTerm}`;
					let res = await fetch(searchUrl);
					if (res.ok) {
						let data = await res.json();
						let media = data[0];
						if (media) {
							mediaAlt =
								media.alt_text || media.title.rendered || null;
						}
					}
				}
				let z = 0;
				async function fetchImg() {
					let form = new FormData();
					if (WPUrl.includes('public-api.wordpress.com')) {
						form.append('url', img.url);
					} else {
						let parsedUrl = new URL(img.url);
						form.append(
							'url',
							`https://i${z}.wp.com/${parsedUrl.hostname}${parsedUrl.pathname}`
						);
					}
					try {
						let response = await fetch('proxy.php', {
							method: 'POST',
							body: form,
						});
						if (!response.ok && z < 3) {
							z++;
							fetchImg();
						} else if (!response.ok && z >= 3) {
							return null;
						} else {
							return response;
						}
					} catch (error) {
						if (z < 3) {
							z++;
							fetchImg();
						} else {
							return null;
						}
					}
				}
				let response = await fetchImg();
				resolve([response, mediaAlt]);
			});
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
			overlay.style.display = 'none';
			const newFiles = e.dataTransfer.items;
			if (files.length >= maxMedia) {
				window.alert(locData['media-alert']);
				return;
			} else {
				for (let f of newFiles) {
					if (files.length < maxMedia) {
						let mediaFile = {};
						if (f.kind === 'file') {
							f = f.getAsFile();
							mediaFile.file = f;
							files.push(mediaFile);
							displayThumbnail(mediaFile, imgPreview, imgCount);
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
											imgCount
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
						window.alert(locData['media-alert']);
						break;
					}
				}
			}
		});

		addImg.onclick = () => {
			imgUpload.click();
		};
		imgUpload.addEventListener('change', async (e) => {
			const newFiles = e.target.files;
			if (files.length >= maxMedia) {
				window.alert(locData['media-alert']);
				return;
			} else {
				for (let f of newFiles) {
					if (files.length < maxMedia) {
						let mediaFile = {};
						mediaFile.file = f;
						files.push(mediaFile);
						displayThumbnail(mediaFile, imgPreview, imgCount);
					} else {
						window.alert(locData['media-alert']);
						break;
					}
				}
			}
		});

		const addGif = newPost.querySelector('button.add-gif');
		const gifDialog = document.getElementById('gif-dialog');
		const gifResults = document.getElementById('gif-results');
		const gifCancelBtn = document.getElementById('gif-cancel-btn');
		const gifSearch = document.getElementById('gif-search');
		addGif.onclick = async () => {
			let query = null;
			let fresh = true;
			let adding = false;
			let pos = await getGifs();
			gifDialog.showModal();
			gifCancelBtn.onclick = () => {
				gifResults.innerHTML = '';
				gifResults.scrollTo(0, 0);
				gifDialog.close();
			};
			gifSearch.value = null;
			gifSearch.focus();
			gifResults.onscroll = async () => {
				if (
					gifResults.scrollTop >=
					(gifResults.scrollHeight - gifResults.clientHeight) * 0.9
				) {
					fresh = false;
					if (!adding) {
						pos = await getGifs(query, pos);
					}
				}
			};
			gifSearch.oninput = debounce(async (e) => {
				e.preventDefault();
				fresh = true;
				query = gifSearch.value;
				pos = await getGifs(query);
				if (!pos) {
					query = null;
					gifSearch.value = null;
					fresh = true;
					adding = false;
					gifSearch.focus();
					pos = await getGifs();
				}
			}, 200);
			function debounce(callback, delay) {
				let timer;
				return function (...args) {
					clearTimeout(timer);
					timer = setTimeout(() => callback(...args), delay);
				};
			}
			function createGifPreviews(results) {
				let gifPreviews = Array.from(
					gifResults.querySelectorAll('.gif-preview')
				);
				if (fresh) {
					let removed = gifPreviews.splice(results.length);
					removed.forEach((g) => g.remove());
					gifResults.scrollTo(0, 0);
				}
				for (let r of results) {
					let gifPreview;
					if (fresh && gifPreviews.length > 0) {
						gifPreview = gifPreviews[results.indexOf(r)];
					} else {
						gifPreview = document.createElement('img');
					}
					gifPreview.classList.add('gif-preview');
					gifPreview.src = r.media_formats.tinygif.url;
					gifPreview.alt = r.content_description;
					gifPreview.setAttribute('ref', r.media_formats.gif.url);
					gifResults.appendChild(gifPreview);
				}
				gifPreviews = Array.from(
					gifResults.querySelectorAll('.gif-preview')
				);
				if (gifPreviews && gifPreviews.length > 0) {
					for (let g of gifPreviews) {
						g.onclick = async () => {
							let mediaFile = {};
							let response = await fetch(g.getAttribute('ref'));
							let blob = await response.blob();
							const file = new File([blob], 'image.gif', {
								type: blob.type,
							});
							mediaFile.file = file;
							mediaFile.description = g.alt;
							if (files.length < maxMedia) {
								files.push(mediaFile);
								displayThumbnail(
									mediaFile,
									imgPreview,
									imgCount
								);
								gifDialog.close();
							} else {
								window.alert(locData['media-alert']);
								return;
							}
						};
					}
				}
				adding = false;
			}
			async function getGifs(query, pos) {
				adding = true;
				try {
					let gifUrl = `gifsearch.php?locale=${lang}`;
					if (query) {
						gifUrl += `&q=${query}`;
					}
					if (pos) {
						gifUrl += `&pos=${pos}`;
					}
					let res = await fetch(gifUrl);
					if (res.ok) {
						let data = await res.json();
						if (data.results && data.results.length > 0) {
							createGifPreviews(data.results, fresh);
							return data.next;
						} else {
							window.alert(locData['no-result']);
							return pos;
						}
					} else {
						window.alert(locData['gif-error']);
						return pos;
					}
				} catch (error) {
					console.error('Error fetching gifs:', error);
					return pos;
				}
			}
		};

		textarea.addEventListener('paste', (e) => {
			overlay.style.display = 'none';
			const items = (e.clipboardData || e.originalEvent.clipboardData)
				.items;
			for (let item of items) {
				if (item.kind === 'file') {
					let mediaFile = {};
					const file = item.getAsFile();
					if (files.length < maxMedia) {
						mediaFile.file = file;
						files.push(mediaFile);
						displayThumbnail(mediaFile, imgPreview, imgCount);
					} else {
						window.alert(locData['media-alert']);
						break;
					}
				}
			}
		});

		function displayThumbnail(mediaFile, imgPreview, imgCount) {
			dropzone.style.display = 'flex';
			imgPreview.style.display = 'flex';
			imgCount.style.display = 'flex';
			addPoll.disabled = true;
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
				window.alert(locData['unsupported-media']);
				const index = files.indexOf(mediaFile);
				if (index > -1) {
					files.splice(index, 1);
				}
				div.remove();
				imgCount.textContent = `${files.length}/${maxMedia}`;
				return;
			}

			if (fileType.includes('video')) {
				if (mediaFile.file.size > vidSizeLimit) {
					window.alert(
						`${locData['over-limit']} ${vidSizeLimit / 1000000} MB.`
					);
					const index = files.indexOf(mediaFile);
					if (index > -1) {
						files.splice(index, 1);
					}
					div.remove();
					imgCount.textContent = `${files.length}/${maxMedia}`;
					if (files.length === 0) {
						dropzone.style.display = 'none';
						imgPreview.style.display = 'none';
						imgCount.style.display = 'none';
						addPoll.disabled = false;
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
			} else if (fileType.includes('image') || fileType.includes('img')) {
				if (mediaFile.file.size > imgSizeLimit) {
					window.alert(
						`${locData['over-limit']} ${imgSizeLimit / 1000000} MB.`
					);
					const index = files.indexOf(mediaFile);
					if (index > -1) {
						files.splice(index, 1);
					}
					div.remove();
					imgCount.textContent = `${files.length}/${maxMedia}`;
					if (files.length === 0) {
						dropzone.style.display = 'none';
						imgPreview.style.display = 'none';
						imgCount.style.display = 'none';
						addPoll.disabled = false;
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
					dropzone.style.display = 'none';
					imgPreview.style.display = 'none';
					imgCount.style.display = 'none';
					addPoll.disabled = false;
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
			altBtn.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: #ffffff;"></i><span>&nbsp;ALT</span>`;
			altBtn.classList.add('alt-btn');
			const altDialog = imgPreview.querySelector('.alt-dialog');
			const newAltDialog = altDialog.cloneNode(true);
			const newAltDiv = newAltDialog.querySelector('.alt-div');
			const altTextArea = newAltDialog.querySelector('.alt-text');

			if (mediaFile.description) {
				altTextArea.value = mediaFile.description;
				setAltBtn();
				if (previewElt) {
					previewElt.alt = mediaFile.description;
					previewElt.title = mediaFile.description;
				}
			}

			const altCounter = newAltDiv.querySelector('.alt-counter');
			newAltDialog.addEventListener('click', (e) => {
				e.stopPropagation();
			});
			newAltDiv.addEventListener('click', (e) => {
				e.stopPropagation();
			});
			altTextArea.addEventListener('input', () => {
				altCounter.textContent = `${altTextArea.value.length}/${altLimit}`;
				if (altTextArea.value.length > altLimit) {
					altCounter.style.color = '#cc0000';
					altCounter.style.fontWeight = 'bold';
				} else {
					altCounter.removeAttribute('style');
				}
			});
			const altSaveBtn = newAltDiv.querySelector('.alt-save-btn');
			const altCancelBtn = newAltDiv.querySelector('.alt-cancel-btn');
			altTextArea.addEventListener('keydown', (e) => {
				if (
					(e.key === 'Enter' && e.metaKey) ||
					(e.key === 'Enter' && e.ctrlKey)
				) {
					e.preventDefault();
					altSaveBtn.click();
				} else if (e.key === 'Escape') {
					e.preventDefault();
					altCancelBtn.click();
				}
			});

			function setAltBtn() {
				altBtn.classList.add('alt-set');
				altBtn.innerHTML = `<i class="fa-solid fa-check" style="color: #009900;"></i><span>&nbsp;ALT</span>`;
			}

			function unsetAltBtn() {
				altBtn.classList.remove('alt-set');
				altBtn.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: #ffffff;"></i><span>&nbsp;ALT</span>`;
			}

			altBtn.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				if (mediaFile.description) {
					altTextArea.value = mediaFile.description;
				} else {
					altTextArea.value = null;
				}
				altCounter.textContent = `${altTextArea.value.length}/${altLimit}`;
				const newImgThumbnail =
					newAltDialog.querySelector('.img-thumbnail');
				newImgThumbnail.innerHTML = '';
				const altPreview = previewElt.cloneNode(true);
				newImgThumbnail.appendChild(altPreview);
				altTextArea.focus();
				newAltDialog.showModal();
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
					setAltBtn();
				} else if (!altText || altText.length === 0) {
					if (previewElt) {
						previewElt.removeAttribute('alt');
						previewElt.removeAttribute('title');
					}
					delete mediaFile.description;
					unsetAltBtn();
				}
				newAltDialog.close();
			});
			altCancelBtn.addEventListener('click', async (e) => {
				e.stopPropagation();
				newAltDialog.close();
			});

			div.appendChild(altBtn);
			div.appendChild(newAltDialog);
		}

		// Handle poll creation
		addPoll.addEventListener('click', () => {
			if (pollContainer.style.display === 'flex') {
				addPoll.removeAttribute('style');
				addPoll.innerHTML = `<i class="fa-solid fa-square-poll-vertical"></i>`;
				addImg.disabled = false;
				addGif.disabled = false;
				pollContainer.style.display = 'none';
				handlePollOptions(true);
			} else {
				addPoll.style.backgroundColor = '#563acc';
				addPoll.innerHTML = `<i class="fa-solid fa-square-poll-vertical" style="color: #ffffff;"></i>`;
				addImg.disabled = true;
				addGif.disabled = true;
				pollContainer.style.display = 'flex';
				handlePollOptions(false);
			}
		});

		function handlePollOptions(clear) {
			const id = newPost.id.split('-')[1];
			const poll = polls[`polls${id}`] || {};
			if (clear) {
				delete polls[`polls${id}`];
				const pollAnswers = Array.from(
					pollContainer.querySelectorAll('.poll-option')
				);
				pollAnswers.forEach((answer) => {
					const index = pollAnswers.indexOf(answer);
					if (index > 0) {
						answer.remove();
					}
				});
				return;
			}
			const maxOptions = pollOptions.max_options || 4;
			const maxOptionChars = pollOptions.max_characters_per_option || 50;
			const minExp = pollOptions.min_expiration || 300;
			const maxExp = pollOptions.max_expiration || 2629746;
			polls[`polls${id}`] = poll;
			const expSelect = pollContainer.querySelector(
				'.poll-duration-select'
			);
			const expOptions = expSelect.querySelectorAll('option');
			expOptions.forEach((option) => {
				let value = parseInt(option.value);
				if (value < minExp || value > maxExp) {
					option.remove();
				}
			});
			poll.expires_in = expSelect.value;
			expSelect.addEventListener('change', (e) => {
				poll.expires_in = e.target.value;
			});
			const multipleChoiceCheckbox = pollContainer.querySelector(
				'.poll-multiple-input'
			);
			multipleChoiceCheckbox.checked = poll.multiple || false;
			poll.multiple = multipleChoiceCheckbox.checked;
			multipleChoiceCheckbox.addEventListener('change', (e) => {
				poll.multiple = e.target.checked;
			});
			poll.options = [];
			const pollOptionsDiv =
				pollContainer.querySelector('.poll-options-div');
			const pollOptionTemplate =
				pollOptionsDiv.querySelector('.poll-option');
			for (let i = 1; i <= maxOptions; i++) {
				const pollAnswer = pollOptionTemplate.cloneNode(true);
				pollOptionsDiv.appendChild(pollAnswer);
				if (i < 3) {
					pollAnswer.style.display = 'flex';
				}
				const answerInput = pollAnswer.querySelector('.poll-text');
				if (i === 1) {
					answerInput.focus();
				}
				answerInput.maxLength = maxOptionChars;
				answerInput.setAttribute(
					'placeholder',
					`${locData['poll-option-placeholder']} ${i}`
				);
				answerInput.addEventListener('input', (e) => {
					const optionText = e.target.value.trim();
					if (optionText.length > maxOptionChars) {
						answerInput.value = optionText.slice(0, maxOptionChars);
					}
					if (optionText.length > 0) {
						const nextAnswer = pollAnswer.nextElementSibling;
						if (nextAnswer && i + 1 <= maxOptions) {
							nextAnswer.style.display = 'flex';
						}
					} else if (optionText.length === 0) {
						const nextAnswer = pollAnswer.nextElementSibling;
						if (nextAnswer && i + 1 <= maxOptions) {
							const nextInput =
								nextAnswer.querySelector('.poll-text');
							if (nextInput.value.length === 0) {
								nextAnswer.style.display = 'none';
								nextInput.value = null;
							}
						}
					}
					if (optionText.length) {
						poll.options[i - 1] = optionText.trim();
					} else {
						poll.options.splice(i - 1, 1);
					}
				});
			}
		}

		// Handle post deletion
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
				updateCharCount(firstPost, textarea.value, textarea);
			}
			const firstVizSelect = firstPost.querySelector('.viz-select');
			firstVizSelect.value = defaultViz;
		});
		updatePostList(message, oldPosts);
		textarea.focus();
		return newPost;
	}

	// Function to split long text into separate toots
	async function splitIntoToots(newPost, postText, textarea) {
		if (isSplitting) {
			return;
		}
		isSplitting = true;
		splitNb++;
		textarea.value = null;
		postText = postText.trim();
		const regex = /([,.;:!?”"»]\s)/gu;
		const chunks = postText.split(regex);
		let remainingChunks;
		for (let i = 0; i < chunks.length; i += 2) {
			let chunk1 = chunks[i];
			let chunk2 = chunks[i + 1] || '';
			let chunk = chunk1 + chunk2;
			if (textarea.value.length + chunk.trim().length <= maxChars) {
				textarea.value += chunk;
			} else {
				remainingChunks = chunks.slice(i);
				break;
			}
		}
		updateCharCount(newPost, textarea.value, textarea);
		textarea.focus();
		let flowText = '';
		if (remainingChunks && remainingChunks.length > 0) {
			textarea.value = textarea.value.trim();
			for (let c of remainingChunks) {
				flowText += c;
			}
			if (postItems.length > 0) {
				const addPostBtn = newPost.querySelector('.add-post-btn');
				currentPost = addPostBtn.closest('.post-item');
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

	// Functions to react to change in number of posts
	numberPostsCheckbox.addEventListener('change', async () => {
		let message = 'Updating post list after ticking/unticking checkbox';
		await updatePostList(message, oldPosts);
	});

	function updatePostCount() {
		for (let p of postItems) {
			const i = postItems.indexOf(p);
			const pNo = i + 1;
			const postCount = p.querySelector('.post-count');
			postCount.textContent = `${locData['toot']} ${pNo}/${postItems.length}`;
			p.setAttribute('counter', `${pNo}/${postItems.length}`);
		}
		return postItems.length;
	}

	async function updatePostList(message, oldPosts, nbOfPosts) {
		if (!nbOfPosts) {
			nbOfPosts = postItems.length;
		} else {
		}
		let numberPosts = numberPostsCheckbox.checked;
		optionsDiv.style.marginBottom = '10px';
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
				optionsDiv.style.marginBottom = '0';
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
				updateCharCount(p, textarea.value, textarea);
			} else if (!numberPosts) {
				if (postCount && text.startsWith(postCount)) {
					text = text.replace(postCount, '').trim();
					textarea.value = text;
					updateCharCount(p, textarea.value, textarea);
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

	// Functions to upload thread to Mastodon
	let threadUrl;
	postThreadBtn.addEventListener('click', async () => {
		let staggerMediaUploads = false;
		const NbOfMediaFiles = Object.values(mediaFiles).flat().length;
		if (NbOfMediaFiles > 30) {
			if (
				window.confirm(
					`${locData['stagger-upload-confirm-1']}${NbOfMediaFiles}${locData['stagger-upload-confirm-2']}`
				)
			) {
				window.alert(locData['stagger-upload-alert']);
				staggerMediaUploads = true;
			} else {
				return false;
			}
		}
		for (let key in mediaFiles) {
			if (mediaFiles[key].length > 0) {
				for (let media of mediaFiles[key]) {
					if (!media.description) {
						if (!window.confirm(locData['media-error-confirm'])) {
							const number = key.split('mediaFiles')[1];
							const post = document.getElementById(
								`post-${number}`
							);
							post.scrollIntoView();
							return;
						}
					}
				}
			}
		}
		postThreadBtn.style.display = 'none';
		contentContainer.style.display = 'none';
		counter.style.display = 'block';
		counter.style.marginTop = '50px';
		let ok = await postThread(staggerMediaUploads);
		if (!ok) {
			spinner.style.display = 'none';
			counter.style.display = 'none';
			postThreadBtn.style.display = 'flex';
			contentContainer.style.display = 'flex';
			return;
		}
		spinner.remove();
		counter.textContent = locData['thread-published'];
		counter.style.color = '#563acc';
		const restartBtn = document.createElement('button');
		restartBtn.textContent = locData['restart'];
		restartBtn.style.marginTop = '50px';
		restartBtn.onclick = () => {
			window.open(window.location.origin, '_self');
		};
		counter.after(restartBtn);
		postThreadBtn.style.display = 'none';
		if (threadUrl) {
			window.open(threadUrl, '_blank');
		}
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
					window.alert(locData['app-warning']);
					return;
				}
				const errorData = await response.json();
				console.error('Error uploading media: ', errorData);
				window.alert(
					`${locData['media-error-alert']} : ${errorData.error}`
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

	async function postThread(staggerMediaUploads) {
		spinner.style.display = 'inline-flex';
		let replyToId;
		if (originalId) {
			replyToId = originalId;
		}
		let scheduledAt = null;
		if (scheduleCheckbox.checked) {
			scheduledAt = new Date(scheduleInput.value);
		}
		for (let post of postItems) {
			const i = postItems.indexOf(post);
			counter.textContent = `${locData['posting-toot']} ${i + 1}/${
				postItems.length
			}...`;

			const langSelect = post.querySelector('.lang-select');
			const postLang = langSelect.value;

			const vizSelect = post.querySelector('.viz-select');
			const visibility = vizSelect.getAttribute('data-value');

			const quoteSelect = post.querySelector('.quote-select');
			const quoteOption = quoteSelect.getAttribute('data-value');

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
					mediaCounter.textContent = `(${locData['media-upload']} ${
						postMedia.indexOf(media) + 1
					}/${postMedia.length}...)`;
					let mediaId = await uploadMedia(
						media.file,
						media.description
					);
					if (!mediaId) {
						window.alert(locData['media-error-alert']);
						return;
					}
					postMediaIds.push(mediaId);
					if (staggerMediaUploads) {
						await new Promise((resolve) =>
							setTimeout(resolve, 60000)
						);
					}
				}
				mediaCounter.remove();
			}
			if (!postText && postMedia.length === 0) {
				if (i === 0) {
					if (postItems.length === 1) {
						window.alert(locData['empty-thread']);
						return;
					}
					window.alert(locData['empty-toot']);
					return;
				}
				continue;
			}
			const postPoll = polls[`polls${id}`];
			if (postPoll) {
				postPoll.options = postPoll.options.filter(
					(option) => option && option.length > 0
				);
				if (postPoll.options.length < 2) {
					window.alert(locData['poll-option-alert']);
					return;
				}
			}
			const quotedStatusId = quotedStatuses[`quotedStatus${id}`];
			try {
				const body = {
					status: postText,
					media_ids: postMediaIds,
					visibility: visibility,
					quote_approval_policy: quoteOption,
					in_reply_to_id: replyToId,
					language: postLang,
				};
				if (cwText) {
					body.spoiler_text = cwText;
					body.sensitive = true;
				}
				if (scheduledAt) {
					body.scheduled_at = scheduledAt.toISOString();
				}
				if (postPoll) {
					body.poll = postPoll;
				}
				if (quotedStatusId) {
					body.quoted_status_id = quotedStatusId;
				}
				const response = await fetch(
					`https://${instance}/api/v1/statuses`,
					{
						method: 'POST',
						headers: {
							Authorization: `Bearer ${token}`,
							'Content-Type': 'application/json',
							scope: 'write',
						},
						body: JSON.stringify(body),
					}
				);

				if (!response.ok) {
					if (response.status === 401) {
						window.alert(locData['app-warning']);
						return;
					}
					const errorData = await response.json();
					console.error('Error posting status: ', errorData);
					window.alert(
						`${locData['posting-error-1']}${id} ${locData['posting-error-2']}\n${errorData.error}`
					);
					return;
				}
				const data = await response.json();
				replyToId = data.id;
				if (scheduledAt) {
					const seconds = scheduledAt.getUTCSeconds();
					scheduledAt = new Date(
						scheduledAt.setUTCSeconds(seconds + 1)
					);
				}
				if (i === 0) {
					threadUrl = data.url;
				}
				await new Promise((resolve) => setTimeout(resolve, 1000));
			} catch (error) {
				console.error('Fetch error: ', error);
			}
		}
		if (scheduledAt) {
			return true;
		} else {
			return threadUrl;
		}
	}
});
