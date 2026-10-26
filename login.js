// ==================================================================
// ================== إعدادات تسجيل الدخول =========================
// ==================================================================

// 🔑 بيانات الدخول الافتراضية
const DEFAULT_CREDENTIALS = {
    username: 'admin',
    password: 'admin123'
};

// مفاتيح التخزين
// ⚠️ الجلسة بقت في sessionStorage (بتنتهي لما تقفل التاب)
// ⚠️ "تذكرني" فضل في localStorage (يفضل محفوظ)
const SESSION_KEY = 'transactions_auth_session';
const REMEMBER_KEY = 'transactions_remember_username';

// ==================================================================
// ================== عناصر الصفحة =================================
// ==================================================================
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const togglePassword = document.getElementById('togglePassword');
const rememberMe = document.getElementById('rememberMe');
const loginBtn = document.getElementById('loginBtn');
const alertBox = document.getElementById('alertBox');
const usernameError = document.getElementById('usernameError');
const passwordError = document.getElementById('passwordError');

// ==================================================================
// ================== إظهار/إخفاء كلمة المرور ======================
// ==================================================================
if (togglePassword) {
    togglePassword.addEventListener('click', () => {
        const type = passwordInput.type === 'password' ? 'text' : 'password';
        passwordInput.type = type;

        const icon = togglePassword.querySelector('i');
        if (type === 'text') {
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    });
}

// ==================================================================
// ================== إظهار الرسائل ================================
// ==================================================================
function showError(message) {
    alertBox.className = 'alert-box error';
    alertBox.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${message}`;
    alertBox.style.display = 'flex';

    setTimeout(() => {
        alertBox.style.display = 'none';
    }, 4000);
}

function showSuccess(message) {
    alertBox.className = 'alert-box success';
    alertBox.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${message}`;
    alertBox.style.display = 'flex';
}

function clearErrors() {
    usernameError.textContent = '';
    usernameError.classList.remove('show');
    passwordError.textContent = '';
    passwordError.classList.remove('show');
    usernameInput.classList.remove('error');
    passwordInput.classList.remove('error');
    alertBox.style.display = 'none';
}

function setFieldError(input, errorEl, message) {
    input.classList.add('error');
    errorEl.textContent = message;
    errorEl.classList.add('show');
}

// ==================================================================
// ================== التحقق من صحة البيانات =======================
// ==================================================================
function validateForm() {
    clearErrors();
    let isValid = true;

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username) {
        setFieldError(usernameInput, usernameError, 'من فضلك أدخل اسم المستخدم');
        isValid = false;
    } else if (username.length < 3) {
        setFieldError(usernameInput, usernameError, 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل');
        isValid = false;
    }

    if (!password) {
        setFieldError(passwordInput, passwordError, 'من فضلك أدخل كلمة المرور');
        isValid = false;
    } else if (password.length < 4) {
        setFieldError(passwordInput, passwordError, 'كلمة المرور يجب أن تكون 4 أحرف على الأقل');
        isValid = false;
    }

    return isValid;
}

// ==================================================================
// ================== إزالة الخطأ عند الكتابة ======================
// ==================================================================
usernameInput.addEventListener('input', () => {
    usernameInput.classList.remove('error');
    usernameError.classList.remove('show');
    alertBox.style.display = 'none';
});

passwordInput.addEventListener('input', () => {
    passwordInput.classList.remove('error');
    passwordError.classList.remove('show');
    alertBox.style.display = 'none';
});

// ==================================================================
// ================== معالجة تسجيل الدخول ==========================
// ==================================================================
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    // حالة التحميل
    loginBtn.disabled = true;
    const btnText = loginBtn.querySelector('.btn-text');
    const btnLoader = loginBtn.querySelector('.btn-loader');
    const btnIcon = loginBtn.querySelector('.btn-icon');

    btnText.textContent = 'جاري التحقق...';
    btnLoader.style.display = 'inline-flex';
    btnIcon.style.display = 'none';

    // محاكاة الاتصال بالسيرفر
    setTimeout(() => {
        // التحقق من البيانات
        if (username === DEFAULT_CREDENTIALS.username && password === DEFAULT_CREDENTIALS.password) {
            // ✅ نجاح
            showSuccess('تم تسجيل الدخول بنجاح! جاري التحويل...');

            // ✅ حفظ الجلسة في sessionStorage (بتنتهي لما تقفل التاب)
            const session = {
                username: username,
                loginTime: Date.now(),
                token: generateToken()
            };

            sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

            // ✅ "تذكرني" فضل في localStorage (اسم المستخدم بس، مش الجلسة)
            if (rememberMe.checked) {
                localStorage.setItem(REMEMBER_KEY, username);
            } else {
                localStorage.removeItem(REMEMBER_KEY);
            }

            // عرض شاشة الترحيب والتحويل
            showWelcomeAndRedirect();

        } else {
            // ❌ فشل
            loginBtn.disabled = false;
            btnText.textContent = 'تسجيل الدخول';
            btnLoader.style.display = 'none';
            btnIcon.style.display = 'inline-flex';

            showError('اسم المستخدم أو كلمة المرور غير صحيحة');

            // اهتزاز النموذج
            const form = document.querySelector('.login-form-container');
            form.style.animation = 'shake 0.5s';
            setTimeout(() => {
                form.style.animation = '';
            }, 500);
        }
    }, 1200);
});

// ==================================================================
// ================== توليد توكن عشوائي ============================
// ==================================================================
function generateToken() {
    return 'tk_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 15);
}

// ==================================================================
// ================== شاشة الترحيب والتحويل ========================
// ==================================================================
function showWelcomeAndRedirect() {
    const overlay = document.createElement('div');
    overlay.className = 'welcome-overlay';
    overlay.innerHTML = `
        <div class="welcome-content">
            <div class="welcome-icon">
                <i class="fa-solid fa-check"></i>
            </div>
            <h2>مرحباً بك! 👋</h2>
            <p>جاري تحويلك إلى لوحة التحكم...</p>
        </div>
    `;
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
        overlay.classList.add('show');
    });

    setTimeout(() => {
        window.location.replace('index.html');
    }, 1500);
}

// ==================================================================
// ================== ✅ التحقق من الجلسة ===========================
// ==================================================================
// - sessionStorage: الجلسة بتنتهي لما تقفل التاب
// - لو الجلسة صالحة (أقل من 24 ساعة) → تحويل فوري لـ index.html
// - لو تالفة أو منتهية → مسحها والبقاء في صفحة الدخول

function checkExistingSession() {
    // 🔧 تجاوز للاختبار
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('force') === '1') {
        sessionStorage.removeItem(SESSION_KEY);
        return;
    }

    const session = sessionStorage.getItem(SESSION_KEY);
    if (!session) return;

    try {
        const parsed = JSON.parse(session);

        // ✅ تحقق كامل من صحة بيانات الجلسة
        if (!parsed || !parsed.username || !parsed.token || !parsed.loginTime) {
            sessionStorage.removeItem(SESSION_KEY);
            return;
        }

        // ✅ تحقق إن الجلسة مش أقدم من 24 ساعة
        const SESSION_MAX_AGE = 24 * 60 * 60 * 1000;
        const age = Date.now() - parsed.loginTime;

        if (age < SESSION_MAX_AGE && age >= 0) {
            // جلسة صالحة → حوّل للوحة التحكم
            window.location.replace('index.html');
            return;
        }

        // جلسة منتهية → امسحها
        sessionStorage.removeItem(SESSION_KEY);
    } catch (e) {
        console.error('خطأ في قراءة الجلسة:', e);
        sessionStorage.removeItem(SESSION_KEY);
    }
}

// ==================================================================
// ================== استرجاع اسم المستخدم المحفوظ ==================
// ==================================================================
function restoreRememberedUsername() {
    const remembered = localStorage.getItem(REMEMBER_KEY);
    if (remembered) {
        usernameInput.value = remembered;
        rememberMe.checked = true;
        setTimeout(() => passwordInput.focus(), 300);
    } else {
        setTimeout(() => usernameInput.focus(), 300);
    }
}

// ==================================================================
// ================== ✅ تشغيل أولي =================================
// ==================================================================

// 1) افحص الجلسة أولاً — لو صالحة، حوّل فوراً
checkExistingSession();

// 2) استرجع اسم المستخدم المحفوظ
restoreRememberedUsername();

// ==================================================================
// ================== CSS للاهتزاز =================================
// ==================================================================
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
        20%, 40%, 60%, 80% { transform: translateX(8px); }
    }
`;
document.head.appendChild(shakeStyle);
