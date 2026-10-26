// ==================================================================
// ================== إدارة البيانات (localStorage) =================
// ==================================================================

const STORAGE_KEY = 'transactions_platform_data_v1';
const BALANCES_STORAGE_KEY = 'balances_platform_data_v1';

let _idCounter = 0;
function generateRowId() {
    _idCounter++;
    return Date.now().toString(36) + '_' + _idCounter.toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

// ================================================================
// ========== ✅ تحميل بيانات لوحة التحكم فقط =====================
// ================================================================
function loadData() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                parsed.forEach((row) => {
                    if (row.comment === undefined || row.comment === null) row.comment = '';
                    if (row.cardIssueReason === undefined) row.cardIssueReason = row.note || '';
                    if (row.newCardNumber === undefined) row.newCardNumber = '';
                    if (row.sendDate === undefined) row.sendDate = '';
                    if (row.receiveDate === undefined) row.receiveDate = '';
                    if (row.cardIssued === undefined) row.cardIssued = 'لا';
                    if (row._id === undefined) row._id = generateRowId();
                    if (row.files === undefined || row.files === null) row.files = [];
                });
                return parsed;
            }
        }
    } catch (e) {
        console.error('خطأ في تحميل البيانات:', e);
    }

    if (typeof DEFAULT_DATA !== 'undefined') {
        return DEFAULT_DATA.map(row => ({
            ...row,
            comment: row.comment || '',
            cardIssueReason: row.cardIssueReason || row.note || '',
            newCardNumber: row.newCardNumber || '',
            sendDate: row.sendDate || '',
            receiveDate: row.receiveDate || '',
            cardIssued: row.cardIssued || 'لا',
            _id: generateRowId(),
            files: row.files || []
        }));
    }

    return [];
}

// ================================================================
// ========== ✅ تحميل بيانات الأرصدة (مستقلة) ====================
// ================================================================
function loadBalancesData() {
    try {
        const saved = localStorage.getItem(BALANCES_STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                parsed.forEach((row) => {
                    if (row._id === undefined) row._id = generateRowId();
                    if (row.dinarBalance === undefined) row.dinarBalance = 0;
                    if (row.dollarBalance === undefined) row.dollarBalance = 0;
                    if (row.comment === undefined || row.comment === null) row.comment = '';
                });
                return parsed;
            }
        }
    } catch (e) {
        console.error('خطأ في تحميل بيانات الأرصدة:', e);
    }
    return [];
}

function saveData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(transactionsData));
    } catch (e) {
        console.error('خطأ في حفظ البيانات:', e);
        alert('⚠️ فشل حفظ البيانات — ممكن الذاكرة ممتلئة\n\nحاول تحذف بعض الملفات المرفقة الكبيرة.');
    }
}

function saveBalancesData() {
    try {
        localStorage.setItem(BALANCES_STORAGE_KEY, JSON.stringify(balancesData));
    } catch (e) {
        console.error('خطأ في حفظ بيانات الأرصدة:', e);
        alert('⚠️ فشل حفظ بيانات الأرصدة — ممكن الذاكرة ممتلئة.');
    }
}

const transactionsData = loadData();
const balancesData = loadBalancesData();

let rowIndexMap = new Map();
function rebuildRowIndexMap() {
    rowIndexMap.clear();
    for (let i = 0; i < transactionsData.length; i++) {
        const id = transactionsData[i]._id;
        if (id) rowIndexMap.set(id, i);
    }
}

function findRowIndexById(id) {
    return rowIndexMap.has(id) ? rowIndexMap.get(id) : -1;
}

let balancesRowIndexMap = new Map();
function rebuildBalancesRowIndexMap() {
    balancesRowIndexMap.clear();
    for (let i = 0; i < balancesData.length; i++) {
        const id = balancesData[i]._id;
        if (id) balancesRowIndexMap.set(id, i);
    }
}

function findBalanceRowIndexById(id) {
    return balancesRowIndexMap.has(id) ? balancesRowIndexMap.get(id) : -1;
}

// ==================================================================
// ================== ✅ دوال مساعدة للفلاتر والبحث ==================
// ==================================================================

function matchesFilterValue(rowValue, selectedValues) {
    if (!selectedValues || selectedValues.length === 0) return true;

    const stringValue = String(rowValue ?? '').trim();

    if (selectedValues.includes(stringValue)) return true;

    const numValue = Number(stringValue);
    if (stringValue !== '' && !isNaN(numValue)) {
        return selectedValues.some(s => {
            const sTrim = String(s ?? '').trim();
            if (sTrim === '') return false;
            const sNum = Number(sTrim);
            if (!isNaN(sNum)) {
                return Math.abs(sNum - numValue) < 0.001;
            }
            return false;
        });
    }

    return false;
}

function buildFilterValues(rows, col) {
    const valuesSet = new Set();

    rows.forEach(row => {
        let v;
        if (col === 'cardIssueReason') v = row.cardIssueReason || row.note || '';
        else if (col === 'newCardNumber') v = row.newCardNumber || '';
        else if (col === 'sendDate') v = row.sendDate || '';
        else if (col === 'receiveDate') v = row.receiveDate || '';
        else if (col === 'cardIssued') v = row.cardIssued || 'لا';
        else v = row[col];

        if (col === 'dinarBalance' || col === 'dollarBalance' || col === 'depositValue') {
            const num = Number(v) || 0;
            valuesSet.add(num % 1 === 0 ? String(num) : String(num));
        } else {
            valuesSet.add(String(v ?? '').trim());
        }
    });

    return [...valuesSet].sort((a, b) => {
        const na = Number(a);
        const nb = Number(b);
        const aIsNum = a !== '' && !isNaN(na);
        const bIsNum = b !== '' && !isNaN(nb);
        if (aIsNum && bIsNum) return na - nb;
        return String(a).localeCompare(String(b), 'ar');
    });
}

function searchMatches(searchQuery, row) {
    if (!searchQuery) return true;
    const q = String(searchQuery).trim().toLowerCase();
    if (!q) return true;

    const candidates = [
        row.name,
        normalizeAccount(row.account),
        normalizeCard(row.card),
        normalizeNationalId(row.nationalId),
        normalizePhone(row.phone),
        row.supplier,
        row.note,
        row.comment,
        row.cardIssueReason,
        row.newCardNumber,
        row.sendDate,
        row.receiveDate,
        row.depositDate,
        row.dinarBalance,
        row.dollarBalance,
        row.depositValue
    ];

    for (const c of candidates) {
        if (c === undefined || c === null) continue;
        if (String(c).toLowerCase().includes(q)) return true;
    }

    const qDigits = q.replace(/[^\d]/g, '');
    if (qDigits) {
        const qWithoutLeadingZero = qDigits.replace(/^0+/, '');
        const qWithLeadingZero = '0' + qWithoutLeadingZero;

        for (const c of candidates) {
            if (c === undefined || c === null) continue;
            const cStr = String(c).trim();
            if (!cStr) continue;

            const cDigits = cStr.replace(/[^\d]/g, '');
            if (!cDigits) continue;

            const cWithoutLeadingZero = cDigits.replace(/^0+/, '');
            const cWithLeadingZero = '0' + cWithoutLeadingZero;

            if (cDigits === qDigits) return true;
            if (cWithoutLeadingZero === qWithoutLeadingZero) return true;
            if (cWithLeadingZero === qWithLeadingZero) return true;

            if (cDigits.includes(qDigits)) return true;
            if (cWithoutLeadingZero.includes(qWithoutLeadingZero)) return true;
        }
    }

    return false;
}

// ==================================================================
// ================== ✅ تحويل خلايا Excel بأمان ====================
// ==================================================================

function excelCellToString(value) {
    if (value === undefined || value === null) return '';

    if (value instanceof Date && !isNaN(value.getTime())) {
        const yyyy = value.getFullYear();
        const mm = String(value.getMonth() + 1).padStart(2, '0');
        const dd = String(value.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    if (typeof value === 'number') {
        if (Number.isInteger(value)) return String(value);
        return String(parseFloat(value.toFixed(10)));
    }

    return String(value).trim();
}

function excelCellToNumber(value) {
    if (value === undefined || value === null) return 0;
    if (typeof value === 'number') return isNaN(value) ? 0 : value;

    const cleaned = String(value)
        .replace(/,/g, '')
        .replace(/[^\d.-]/g, '')
        .trim();

    if (cleaned === '' || cleaned === '-' || cleaned === '.') return 0;
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
}

// ==================================================================
// ================== إدارة الملفات المرفقة =========================
// ==================================================================

const MAX_FILE_SIZE = 2 * 1024 * 1024;

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function getFileIcon(fileName, mimeType) {
    const name = (fileName || '').toLowerCase();
    const mime = (mimeType || '').toLowerCase();
    if (mime.includes('pdf') || name.endsWith('.pdf')) return '📄';
    if (mime.includes('image') || /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(name)) return '🖼️';
    if (/\.(doc|docx)$/i.test(name) || mime.includes('word')) return '📝';
    if (/\.(xls|xlsx)$/i.test(name) || mime.includes('sheet')) return '📊';
    if (/\.(zip|rar|7z)$/i.test(name)) return '🗜️';
    if (/\.(txt)$/i.test(name)) return '📃';
    if (/\.(mp4|avi|mov|mkv)$/i.test(name)) return '🎬';
    if (/\.(mp3|wav|ogg)$/i.test(name)) return '🎵';
    return '📎';
}

function formatFileSize(bytes) {
    if (!bytes || bytes < 1024) return (bytes || 0) + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

// ==================================================================
// ================== عناصر الصفحة ==================================
// ==================================================================
const tableBody = document.getElementById('tableBody');
const searchInput = document.getElementById('searchInput');
const refreshBtn = document.getElementById('refreshBtn');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');

const importBtn = document.getElementById('importBtn');
const excelInput = document.getElementById('excelInput');
const clearDataBtn = document.getElementById('clearDataBtn');

const filterDropdown = document.getElementById('filterDropdown');
const filterList = document.getElementById('filterList');
const filterSearchInput = document.getElementById('filterSearchInput');
const filterClear = document.getElementById('filterClear');
const filterApply = document.getElementById('filterApply');

const compareBtn = document.getElementById('compareBtn');
const compareModal = document.getElementById('compareModal');
const compareModalClose = document.getElementById('compareModalClose');
const compareInput = document.getElementById('compareInput');
const compareInputCount = document.getElementById('compareInputCount');
const compareClear = document.getElementById('compareClear');
const compareRun = document.getElementById('compareRun');

// ==================================================================
// ================== متغيرات الحالة ================================
// ==================================================================
let activeFilters = {};
let currentFilterCol = null;
let compareAccountsSet = null;
let compareResult = null;
let currentPage = 'dashboard';

let problemsSearchQuery = '';
let problemsActiveFilters = {};
let problemsCurrentFilterCol = null;

let cardsSearchQuery = '';
let cardsActiveFilters = {};
let cardsCurrentFilterCol = null;

let balancesSearchQuery = '';
let balancesActiveFilters = {};
let balancesCurrentFilterCol = null;

window.__showOnlyConflicts = false;

// ==================================================================
// ================== متغيرات Pagination ============================
// ==================================================================
const PAGE_SIZE = 100;

let dashboardPage = 1;
let problemsPage = 1;
let cardsPage = 1;
let balancesPage = 1;

let currentFilesRowId = null;

function debounce(fn, delay = 250) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// ==================================================================
// ================== استخراج آخر 6 أرقام من الحساب =================
// ==================================================================
function getLast6Digits(account) {
    if (!account) return '';
    const cleaned = String(account).replace(/\s/g, '').replace(/[^\d]/g, '');
    if (cleaned.length < 6) return cleaned;
    return cleaned.slice(-6);
}

// ==================================================================
// ================== تجميع الحسابات المتشابهة واختيار الأفضل =======
// ==================================================================
function resolveDuplicateAccounts(rows, currencyLabel) {
    const groups = new Map();

    rows.forEach(r => {
        const key = getLast6Digits(r.account);
        if (!key) {
            const uniqKey = '__no_key__' + Math.random();
            groups.set(uniqKey, [r]);
            return;
        }
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(r);
    });

    const result = [];

    groups.forEach((groupRows, key) => {
        if (groupRows.length === 1) {
            result.push({ ...groupRows[0], note: '' });
            return;
        }

        const withValue = groupRows.filter(r => (parseFloat(r.balance) || 0) > 0);
        const zeroRows = groupRows.filter(r => (parseFloat(r.balance) || 0) === 0);

        let chosen;
        let note = '';

        if (withValue.length === 0) {
            chosen = groupRows[0];
            const otherAccounts = groupRows.slice(1).map(r => r.account).join(', ');
            note = `⚠️ كل الحسابات ${currencyLabel} صفر. الحساب المختار: ${chosen.account}. حسابات أخرى بنفس آخر 6 أرقام: ${otherAccounts}`;
        } else if (withValue.length === 1) {
            chosen = withValue[0];
            const otherAccounts = groupRows
                .filter(r => r !== chosen)
                .map(r => `${r.account} (قيمته 0)`)
                .join(', ');
            note = `ℹ️ تم اختيار الحساب ${chosen.account} لأن له قيمة ${currencyLabel}. الحسابات الأخرى بنفس آخر 6 أرقام: ${otherAccounts}`;
        } else {
            chosen = withValue[0];
            const otherWithValue = withValue
                .slice(1)
                .map(r => `${r.account} (قيمته ${formatNumber(r.balance)})`)
                .join(', ');
            const zeros = zeroRows.map(r => r.account).join(', ');

            let parts = [];
            if (otherWithValue) parts.push(`حسابات أخرى لها قيمة: ${otherWithValue}`);
            if (zeros) parts.push(`حسابات صفر: ${zeros}`);

            note = `⚠️ أكثر من حساب له قيمة ${currencyLabel}. تم اختيار ${chosen.account}. ${parts.join(' | ')}`;
        }

        result.push({ ...chosen, note });
    });

    return result;
}

// ==================================================================
// ================== كلمات مفتاحية "معاملات بها مشاكل" =============
// ==================================================================
const PROBLEM_MARKER = '@';

const PROBLEM_KEYWORDS = [
    '0$', 'حسابان دولار', 'حسابان 333 في المصرف', 'صورة شاشه',
    'كشف حساب دينار', 'كشف حساب دولار', 'كشف حساب دينار & دولار',
    'القيمة بالدينار', 'القيمة بالدينار + تحتاج شحن', 'قيمة معلقه', 'قيمة فارة'
];

function isProblemNote(note) {
    if (!note) return false;
    const n = String(note).trim();
    if (!n) return false;
    if (n.includes(PROBLEM_MARKER)) return true;
    return PROBLEM_KEYWORDS.some(keyword => n.includes(keyword));
}

function highlightMarker(note) {
    if (!note) return '';
    const escaped = String(note)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    return escaped
        .replace(/@/g, '<span class="problem-marker">@</span>')
        .replace(/!/g, '<span class="card-marker">!</span>');
}

function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ==================================================================
// ================== كلمات مفتاحية "إصدار البطاقات" ================
// ==================================================================
const CARD_MARKER = '🆕';
const CARD_MARKER_ALT = '!';

const CARD_KEYWORDS = [
    'فتح حساب', 'فتح', 'حساب جديد', 'بطاقة جديدة', 'تحتاج إصدار',
    'إصدار بطاقة', 'إصدار', 'حساب جاهز', 'جاهز', 'جاهز للاستلام',
    'تم الفتح', 'تم الإصدار', 'كود 14', 'كود14', 'صلاحية',
    'بطاقة عند المورد', 'بطاقه عند المورد', 'البطاقة عند المورد', 'البطاقه عند المورد',
    'بطاقة ليست لدينا', 'بطاقه ليست لدينا', 'البطاقة ليست لدينا', 'البطاقه ليست لدينا',
    'غير موجودة', 'غير موجوده'
];

function isCardIssueNote(note) {
    if (!note) return false;
    const n = String(note).trim();
    if (!n) return false;
    if (n.includes(CARD_MARKER)) return true;
    if (n.includes(CARD_MARKER_ALT)) return true;
    return CARD_KEYWORDS.some(keyword => n.includes(keyword));
}

function isCardIssueRow(row) {
    if (!row) return false;
    return isCardIssueNote(row.cardIssueReason) || isCardIssueNote(row.note);
}

function ensureCardFields(row) {
    if (!row) return row;
    if (row.cardIssueReason === undefined) row.cardIssueReason = row.note || '';
    if (row.newCardNumber === undefined) row.newCardNumber = '';
    if (row.sendDate === undefined) row.sendDate = '';
    if (row.receiveDate === undefined) row.receiveDate = '';
    if (row.cardIssued === undefined) row.cardIssued = 'لا';
    if (row.files === undefined) row.files = [];
    return row;
}

const NEED_OPEN_KEYWORDS = [
    'فتح حساب', 'فتح', 'حساب جديد', 'بطاقة جديدة', 'تحتاج إصدار', 'إصدار بطاقة', 'إصدار'
];

const READY_KEYWORDS = [
    'جاهز', 'جاهز للاستلام', 'حساب جاهز', 'تم الفتح', 'تم الإصدار',
    'كود 14', 'كود14', 'صلاحية', 'بطاقة عند المورد', 'بطاقه عند المورد',
    'البطاقة عند المورد', 'البطاقه عند المورد', 'بطاقة ليست لدينا', 'بطاقه ليست لدينا',
    'البطاقة ليست لدينا', 'البطاقه ليست لدينا', 'غير موجودة', 'غير موجوده'
];

function getCardIssueReasonText(row) {
    if (!row) return '';
    return String(row.cardIssueReason || row.note || '').trim();
}

function isNeedOpenReason(text) {
    if (!text) return false;
    return NEED_OPEN_KEYWORDS.some(kw => text.includes(kw));
}

function isReadyReason(text) {
    if (!text) return false;
    return READY_KEYWORDS.some(kw => text.includes(kw));
}

// ==================================================================
// ================== دوال تطبيع ===================================
// ==================================================================
function normalizeAccount(v) {
    if (v === undefined || v === null || v === '') return '';
    let s = String(v).trim();
    if (!s) return '';
    if (!s.startsWith('0')) s = '0' + s;
    return s;
}

function normalizePhone(v) {
    if (v === undefined || v === null || v === '') return '';
    let s = String(v).trim();
    if (!s) return '';
    if (!s.startsWith('0')) s = '0' + s;
    return s;
}

function normalizeNationalId(v) {
    if (v === undefined || v === null || v === '') return '';
    return String(v).trim();
}

function normalizeCard(v) {
    if (v === undefined || v === null || v === '') return '';
    return String(v).replace(/\s/g, '').trim();
}

// ==================================================================
// ================== دوال مساعدة ==================================
// ==================================================================
function formatNumber(num) {
    return (Number(num) || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function maskCard(card) {
    if (!card) return '';
    const s = String(card).replace(/\s/g, '');
    if (s.length <= 8) return s;
    return s.slice(0, 8) + '****';
}

function withdrawnBadge(value) {
    if (value === 'نعم') return `<span class="badge active">✓ نعم</span>`;
    return `<span class="badge pending">✗ لا</span>`;
}

function buildNoteCell(row, hasProblem) {
    const noteContent = `${hasProblem ? '⚠️ ' : ''}${highlightMarker(row.note)}`;
    const comment = row.comment ? String(row.comment).trim() : '';
    if (!comment) return noteContent;
    const safeComment = escapeHtml(comment);
    return `<span class="note-with-tooltip" data-comment="${safeComment}" title="${safeComment}">${noteContent}</span>`;
}

function buildFilesButton(row) {
    const hasFiles = row.files && row.files.length > 0;
    const count = hasFiles ? row.files.length : 0;
    return `
        <button class="icon-btn files-btn ${hasFiles ? 'has-files' : ''}" 
                data-action="files" 
                data-row-id="${row._id}" 
                title="${hasFiles ? 'ملفات مرفقة (' + count + ')' : 'إرفاق ملفات'}">
            📎
            ${hasFiles ? `<span class="files-count">${count}</span>` : ''}
        </button>
    `;
}

// ==================================================================
// ================== نظام التنقل بين الصفحات =======================
// ==================================================================
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();

        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        const page = item.dataset.page;
        const title = item.textContent.trim().replace(/\d+$/, '').trim();

        document.querySelector('.page-title').textContent = title;

        document.querySelectorAll('.page-view').forEach(v => v.classList.remove('active'));

        if (page === 'cards') {
            const cardsView = document.getElementById('cardsView');
            if (cardsView) cardsView.classList.add('active');
            document.querySelector('.page-subtitle').textContent = 'إدارة إصدار البطاقات الجديدة';
            currentPage = 'cards';
            updateCardsStats();
            renderCardsTable();
            return;
        }

        if (page === 'problems') {
            const problemsView = document.getElementById('problemsView');
            if (problemsView) problemsView.classList.add('active');
            document.querySelector('.page-subtitle').textContent = 'كل المعاملات اللي فيها مشاكل';
            currentPage = 'problems';
            updateProblemsStats();
            renderProblemsTable();
            return;
        }

        if (page === 'balances') {
            const balancesView = document.getElementById('balancesView');
            if (balancesView) balancesView.classList.add('active');
            document.querySelector('.page-subtitle').textContent = 'إدارة أرصدة الدينار والدولار';
            currentPage = 'balances';
            updateBalancesStats();
            renderBalancesTable();
            return;
        }

        if (page === 'settings') {
            const settingsView = document.getElementById('settingsView');
            if (settingsView) settingsView.classList.add('active');
            document.querySelector('.page-subtitle').textContent = 'إعدادات المنصة والمظهر';
            currentPage = 'settings';
            return;
        }

        const dashboardView = document.getElementById('dashboardView');
        if (dashboardView) dashboardView.classList.add('active');

        document.querySelector('.page-subtitle').textContent = 'نظرة عامة على البيانات';
        currentPage = 'dashboard';
        updateStats();
        renderTable();
    });
});

// ==================================================================
// ================== عرض جدول لوحة التحكم ==========================
// ==================================================================
function getFilteredData() {
    return transactionsData.filter(row => {
        if (compareAccountsSet) {
            const account = normalizeAccount(row.account);
            const nationalId = normalizeNationalId(row.nationalId);
            const card = normalizeCard(row.card);
            const phone = normalizePhone(row.phone);

            const matched =
                compareAccountsSet.has(account) ||
                compareAccountsSet.has(nationalId) ||
                compareAccountsSet.has(card) ||
                compareAccountsSet.has(phone);

            if (!matched) return false;
        }

        const q = searchInput.value.trim();
        if (q && !searchMatches(q, row)) return false;

        for (const col in activeFilters) {
            const selected = activeFilters[col];
            if (!selected || selected.length === 0) continue;
            if (!matchesFilterValue(row[col], selected)) return false;
        }

        return true;
    });
}

function renderTable() {
    const data = getFilteredData();

    if (data.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="11" style="text-align:center; padding:40px; color:var(--text-muted);">
                    لا توجد نتائج مطابقة
                </td>
            </tr>`;
        updatePaginationControls('dashboard', 0, 1, PAGE_SIZE);
        updateCompareBarCount();
        updateFloatingScrollbar();
        return;
    }

    const totalPages = Math.ceil(data.length / PAGE_SIZE);
    if (dashboardPage > totalPages) dashboardPage = totalPages;
    if (dashboardPage < 1) dashboardPage = 1;

    const start = (dashboardPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageData = data.slice(start, end);

    const fragment = document.createDocumentFragment();

    pageData.forEach((row) => {
        const originalIndex = findRowIndexById(row._id);
        const hasProblem = isProblemNote(row.note);
        const hasCardIssue = isCardIssueRow(row);

        let rowClasses = [];
        if (hasProblem) rowClasses.push('problem-row');
        if (hasCardIssue) rowClasses.push('card-issue-row');
        const rowClass = rowClasses.join(' ');

        const tr = document.createElement('tr');
        tr.dataset.index = originalIndex;
        tr.dataset.rowId = row._id;
        tr.className = rowClass;

        tr.innerHTML = `
            <td>${row.name || ''}</td>
            <td style="font-family:monospace;">${normalizeAccount(row.account)}</td>
            <td style="font-family:monospace; color:var(--text-secondary);">${maskCard(row.card)}</td>
            <td style="font-family:monospace; color:var(--text-secondary);">${normalizeNationalId(row.nationalId)}</td>
            <td style="font-family:monospace;">${normalizePhone(row.phone)}</td>
            <td>${row.supplier || ''}</td>
            <td>${row.depositDate || ''}</td>
            <td style="font-weight:800; color:${(Number(row.depositValue) || 0) > 0 ? 'var(--success)' : 'var(--danger)'};">
                ${formatNumber(row.depositValue)} ج.م
            </td>
            <td style="color:${hasProblem ? 'var(--warning)' : 'var(--text-secondary)'}; font-size:13px; font-weight:${hasProblem ? '800' : '600'};">
                ${buildNoteCell(row, hasProblem)}
            </td>
            <td>${withdrawnBadge(row.withdrawn)}</td>
            <td>
                <div class="actions-cell">
                    ${buildFilesButton(row)}
                    <button class="icon-btn" data-action="comment" data-index="${originalIndex}" title="إضافة/تعديل تعليق">💬</button>
                    <button class="icon-btn delete" data-action="delete" data-index="${originalIndex}" title="حذف">🗑️</button>
                </div>
            </td>
        `;

        fragment.appendChild(tr);
    });

    tableBody.innerHTML = '';
    tableBody.appendChild(fragment);

    updatePaginationControls('dashboard', data.length, dashboardPage, PAGE_SIZE);
    updateCompareBarCount();
    updateFloatingScrollbar();
}

function updateStats() {
    const data = transactionsData;
    document.getElementById('statCustomers').textContent = data.length;

    const depositsCount = data.filter(c => (Number(c.depositValue) || 0) > 0).length;
    document.getElementById('statDeposits').textContent = depositsCount;

    const notDepositedCount = data.filter(c => (Number(c.depositValue) || 0) === 0).length;
    document.getElementById('statNotDeposited').textContent = notDepositedCount;

    const problemsCount = data.filter(c => isProblemNote(c.note)).length;
    document.getElementById('statProblems').textContent = problemsCount;

    const withdrawnCount = data.filter(c => c.withdrawn === 'نعم').length;
    document.getElementById('statWithdrawn').textContent = withdrawnCount;

    const navBadge = document.getElementById('navProblemsCount');
    if (navBadge) {
        navBadge.textContent = problemsCount;
        navBadge.style.display = problemsCount > 0 ? 'inline-flex' : 'none';
    }
}

// ==================================================================
// ================== تعديل الخلايا بـ Double Click =================
// ==================================================================
const COLUMN_MAP = {
    0: { field: 'name', type: 'text' },
    1: { field: 'account', type: 'text' },
    2: { field: 'card', type: 'text' },
    3: { field: 'nationalId', type: 'text' },
    4: { field: 'phone', type: 'text' },
    5: { field: 'supplier', type: 'text' },
    6: { field: 'depositDate', type: 'date' },
    7: { field: 'depositValue', type: 'number' },
    8: { field: 'note', type: 'text' },
    9: { field: 'withdrawn', type: 'select', options: ['نعم', 'لا'] }
};

const CARDS_COLUMN_MAP = {
    0: { field: 'name', type: 'text' },
    1: { field: 'account', type: 'text' },
    2: { field: 'nationalId', type: 'text' },
    3: { field: 'phone', type: 'text' },
    4: { field: 'supplier', type: 'text' },
    5: { field: 'cardIssueReason', type: 'text' },
    6: { field: 'newCardNumber', type: 'text' },
    7: { field: 'sendDate', type: 'date' },
    8: { field: 'receiveDate', type: 'date' },
    9: { field: 'cardIssued', type: 'select', options: ['نعم', 'لا'] }
};

const BALANCES_COLUMN_MAP = {
    0: { field: 'name', type: 'text' },
    1: { field: 'account', type: 'text' },
    2: { field: 'nationalId', type: 'text' },
    3: { field: 'dinarBalance', type: 'number' },
    4: { field: 'dollarBalance', type: 'number' },
    5: { field: 'comment', type: 'text' }
};

function startCellEdit(td, rowIndex, colIndex) {
    const alreadyEditing = document.querySelector('td.editing');
    if (alreadyEditing) {
        alreadyEditing.classList.remove('editing');
        renderAllTables();
        return;
    }

    const tr = td.parentElement;
    const tableBodyId = tr.parentElement.id;

    let config;
    let isBalancesTable = false;

    if (tableBodyId === 'cardsTableBody') {
        config = CARDS_COLUMN_MAP[colIndex];
    } else if (tableBodyId === 'balancesTableBody') {
        config = BALANCES_COLUMN_MAP[colIndex];
        isBalancesTable = true;
    } else {
        config = COLUMN_MAP[colIndex];
    }

    if (!config) return;

    const row = isBalancesTable ? balancesData[rowIndex] : transactionsData[rowIndex];
    if (!row) return;

    if (!isBalancesTable) ensureCardFields(row);

    const originalValue = row[config.field];

    let inputEl;
    if (config.type === 'select') {
        inputEl = document.createElement('select');
        config.options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt;
            if (opt === originalValue) option.selected = true;
            inputEl.appendChild(option);
        });
    } else {
        inputEl = document.createElement('input');

        const textOnlyFields = ['account', 'card', 'nationalId', 'phone', 'newCardNumber'];

        if (textOnlyFields.includes(config.field)) {
            inputEl.type = 'text';
            inputEl.setAttribute('inputmode', 'numeric');
        } else {
            inputEl.type = config.type;
            if (config.type === 'number') inputEl.step = '0.01';
        }

        if (config.type === 'date' && originalValue) {
            const isoMatch = String(originalValue).match(/^\d{4}-\d{2}-\d{2}$/);
            if (isoMatch) inputEl.value = originalValue;
            else inputEl.value = '';
        } else {
            inputEl.value = originalValue !== undefined && originalValue !== null ? String(originalValue) : '';
        }
    }

    inputEl.className = 'cell-edit-input';

    td.classList.add('editing');
    td.innerHTML = '';
    td.appendChild(inputEl);

    inputEl.focus();
    if (inputEl.select) inputEl.select();

    let committed = false;

    function commitEdit() {
        if (committed) return;
        committed = true;

        let newValue;
        if (config.type === 'select') {
            newValue = inputEl.value;
        } else if (config.type === 'number') {
            newValue = parseFloat(inputEl.value) || 0;
        } else {
            newValue = inputEl.value.trim();

            const textOnlyFields = ['account', 'card', 'nationalId', 'phone', 'newCardNumber'];
            if (textOnlyFields.includes(config.field) && newValue !== '') {
                if ((config.field === 'account' || config.field === 'phone') && !newValue.startsWith('0')) {
                    newValue = '0' + newValue;
                }
            }
        }

        if (isBalancesTable) {
            balancesData[rowIndex][config.field] = newValue;
            saveBalancesData();
        } else {
            transactionsData[rowIndex][config.field] = newValue;
            saveData();
        }

        td.classList.remove('editing');
        updateStats();
        renderAllTables();
    }

    function cancelEditFn() {
        if (committed) return;
        committed = true;
        td.classList.remove('editing');
        renderAllTables();
    }

    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            inputEl.blur();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEditFn();
        }
    });

    inputEl.addEventListener('blur', () => {
        if (!committed) commitEdit();
    });
}

document.addEventListener('dblclick', (e) => {
    const td = e.target.closest('td');
    if (!td) return;
    if (td.cellIndex === undefined) return;
    if (td.querySelector('.icon-btn')) return;

    const tr = td.parentElement;
    const rowIndex = parseInt(tr.dataset.index);
    if (isNaN(rowIndex)) return;

    startCellEdit(td, rowIndex, td.cellIndex);
});

document.addEventListener('mousedown', (e) => {
    const editingTd = document.querySelector('td.editing');
    if (!editingTd) return;
    if (editingTd.contains(e.target)) return;
    const inputEl = editingTd.querySelector('.cell-edit-input');
    if (inputEl) inputEl.blur();
});

// ==================================================================
// ================== حذف الصف + إدارة التعليق ======================
// ==================================================================
function deleteRow(index) {
    const row = transactionsData[index];
    if (!row) return;
    if (!confirm(`هل أنت متأكد من حذف معاملة "${row.name}"؟`)) return;

    transactionsData.splice(index, 1);
    rebuildRowIndexMap();
    saveData();

    updateStats();
    renderAllTables();
}

function deleteBalanceRow(index) {
    const row = balancesData[index];
    if (!row) return;
    if (!confirm(`هل أنت متأكد من حذف سجل الرصيد "${row.name}"؟`)) return;

    balancesData.splice(index, 1);
    rebuildBalancesRowIndexMap();
    saveBalancesData();

    updateBalancesStats();
    renderBalancesTable();
    updateBalancesFloatingScrollbar();
}

function editComment(index) {
    const row = transactionsData[index];
    if (!row) return;

    const current = row.comment || '';
    const newComment = prompt(
        `💬 تعليق على: ${row.name || '(بدون اسم)'}\n\n` +
        `اترك الحقل فارغ للمسح، أو اضغط Cancel للإلغاء:`,
        current
    );

    if (newComment === null) return;

    row.comment = newComment.trim();
    saveData();
    renderAllTables();
}

function editBalanceComment(index) {
    const row = balancesData[index];
    if (!row) return;

    const current = row.comment || '';
    const newComment = prompt(
        `💬 تعليق على رصيد: ${row.name || '(بدون اسم)'}\n\n` +
        `اترك الحقل فارغ للمسح، أو اضغط Cancel للإلغاء:`,
        current
    );

    if (newComment === null) return;

    row.comment = newComment.trim();
    saveBalancesData();
    updateBalancesStats();
    renderBalancesTable();
}

function markCardAsReceived(index) {
    const row = transactionsData[index];
    if (!row) return;
    ensureCardFields(row);

    const today = new Date().toISOString().split('T')[0];
    const dateInput = prompt(
        `📥 تاريخ استلام البطاقة للعميل: ${row.name || '(بدون اسم)'}\n\n` +
        `(الصيغة: YYYY-MM-DD — مثال: 2026-01-15)`,
        row.receiveDate || today
    );

    if (dateInput === null) return;

    row.receiveDate = dateInput.trim();
    row.cardIssued = row.receiveDate ? 'نعم' : 'لا';

    saveData();
    updateCardsStats();
    updateProblemsStats();
    renderAllTables();

    alert('✅ تم تحديد البطاقة كمستلمة');
}

document.addEventListener('click', (e) => {
    const btn = e.target.closest('.icon-btn');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'files') return;

    const index = parseInt(btn.dataset.index);
    if (isNaN(index)) return;

    const isBalancesTable = btn.closest('#balancesTableBody') !== null;

    if (action === 'delete') {
        if (isBalancesTable) deleteBalanceRow(index);
        else deleteRow(index);
    }
    if (action === 'comment') {
        if (isBalancesTable) editBalanceComment(index);
        else editComment(index);
    }
    if (action === 'mark-received') markCardAsReceived(index);
});

// ==================================================================
// ================== رسم كل الجداول ================================
// ==================================================================
function renderAllTables() {
    renderTable();
    updateProblemsStats();
    renderProblemsTable();
    updateCardsStats();
    renderCardsTable();
    updateBalancesStats();
    renderBalancesTable();
    updateAllFloatingScrollbars();
}

// ==================================================================
// ================== أزرار Pagination ==============================
// ==================================================================
function updatePaginationControls(tableName, totalRows, currentPage, pageSize) {
    const oldPagination = document.getElementById(`pagination_${tableName}`);
    if (oldPagination) oldPagination.remove();

    if (totalRows === 0) return;

    const totalPages = Math.ceil(totalRows / pageSize);
    if (totalPages <= 1) return;

    const tableContainer = document.querySelector(
        tableName === 'dashboard' ? '#dashboardView .table-container' :
        tableName === 'problems' ? '#problemsView .table-container' :
        tableName === 'balances' ? '#balancesView .table-container' :
        '#cardsView .table-container'
    );
    if (!tableContainer) return;

    const pagination = document.createElement('div');
    pagination.id = `pagination_${tableName}`;
    pagination.className = 'pagination-bar';

    const from = (currentPage - 1) * pageSize + 1;
    const to = Math.min(currentPage * pageSize, totalRows);

    let pagesHtml = '';
    const maxButtons = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    if (endPage - startPage + 1 < maxButtons) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }

    for (let p = startPage; p <= endPage; p++) {
        pagesHtml += `<button class="page-btn ${p === currentPage ? 'active' : ''}" data-page="${p}" data-table="${tableName}">${p}</button>`;
    }

    pagination.innerHTML = `
        <div class="pagination-info">
            بيتم عرض <strong>${from}</strong> - <strong>${to}</strong> من <strong>${totalRows}</strong>
        </div>
        <div class="pagination-controls">
            <button class="page-btn nav" data-page="1" data-table="${tableName}" ${currentPage === 1 ? 'disabled' : ''} title="الأولى">⏮️</button>
            <button class="page-btn nav" data-page="${currentPage - 1}" data-table="${tableName}" ${currentPage === 1 ? 'disabled' : ''} title="السابقة">◀️</button>
            ${pagesHtml}
            <button class="page-btn nav" data-page="${currentPage + 1}" data-table="${tableName}" ${currentPage === totalPages ? 'disabled' : ''} title="التالية">▶️</button>
            <button class="page-btn nav" data-page="${totalPages}" data-table="${tableName}" ${currentPage === totalPages ? 'disabled' : ''} title="الأخيرة">⏭️</button>
        </div>
    `;

    const tableScroll = tableContainer.querySelector('.table-scroll');
    if (tableScroll) {
        tableScroll.parentNode.insertBefore(pagination, tableScroll.nextSibling);
    }
}

document.addEventListener('click', (e) => {
    const btn = e.target.closest('.page-btn');
    if (!btn) return;
    if (btn.disabled) return;

    const pageNum = parseInt(btn.dataset.page);
    const tableName = btn.dataset.table;
    if (isNaN(pageNum) || !tableName) return;

    if (tableName === 'dashboard') {
        dashboardPage = pageNum;
        renderTable();
    } else if (tableName === 'problems') {
        problemsPage = pageNum;
        renderProblemsTable();
    } else if (tableName === 'cards') {
        cardsPage = pageNum;
        renderCardsTable();
    } else if (tableName === 'balances') {
        balancesPage = pageNum;
        renderBalancesTable();
    }
});

// ==================================================================
// ================== فلاتر الأعمدة (لوحة التحكم) ===================
// ==================================================================
document.querySelectorAll('.filter-btn:not([data-table="problems"]):not([data-table="cards"]):not([data-table="balances"])').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();

        const col = btn.dataset.col;
        currentFilterCol = col;

        if (filterDropdown.classList.contains('show')) {
            filterDropdown.classList.remove('show');
        }

        buildFilterOptions(col, transactionsData, activeFilters);

        const rect = btn.getBoundingClientRect();
        const dropdownWidth = 240;
        let left = rect.left;
        if (left + dropdownWidth > window.innerWidth) {
            left = window.innerWidth - dropdownWidth - 10;
        }

        filterDropdown.style.top = (rect.bottom + 6) + 'px';
        filterDropdown.style.left = left + 'px';
        filterDropdown.classList.add('show');

        filterSearchInput.value = '';
        filterSearchInput.focus();

        setupMainFilterActions();
    });
});

function buildFilterOptions(col, sourceRows, filterState) {
    const values = buildFilterValues(sourceRows, col);
    const selected = filterState[col] || [];

    filterList.innerHTML = values.map(val => `
        <label class="filter-option">
            <input type="checkbox" value="${escapeHtml(val)}" ${selected.includes(val) ? 'checked' : ''}>
            <span class="check-box"></span>
            <span class="option-label">${escapeHtml(val) || '(فارغ)'}</span>
        </label>
    `).join('');
}

function setupMainFilterActions() {
    const newApply = filterApply.cloneNode(true);
    const newClear = filterClear.cloneNode(true);
    filterApply.parentNode.replaceChild(newApply, filterApply);
    filterClear.parentNode.replaceChild(newClear, filterClear);

    const applyBtn = document.getElementById('filterApply');
    const clearBtn = document.getElementById('filterClear');

    applyBtn.addEventListener('click', () => {
        if (!currentFilterCol) return;

        const selected = [];
        document.querySelectorAll('.filter-option input[type="checkbox"]:checked').forEach(cb => {
            selected.push(cb.value);
        });

        if (selected.length === 0) {
            delete activeFilters[currentFilterCol];
        } else {
            activeFilters[currentFilterCol] = selected;
        }

        const btn = document.querySelector(`.filter-btn[data-col="${currentFilterCol}"]:not([data-table="problems"]):not([data-table="cards"]):not([data-table="balances"])`);
        if (btn) {
            if (activeFilters[currentFilterCol] && activeFilters[currentFilterCol].length > 0) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }

        filterDropdown.classList.remove('show');
        dashboardPage = 1;
        renderTable();
    });

    clearBtn.addEventListener('click', () => {
        if (!currentFilterCol) return;
        delete activeFilters[currentFilterCol];
        const btn = document.querySelector(`.filter-btn[data-col="${currentFilterCol}"]:not([data-table="problems"]):not([data-table="cards"]):not([data-table="balances"])`);
        if (btn) btn.classList.remove('active');
        filterDropdown.classList.remove('show');
        dashboardPage = 1;
        renderTable();
    });
}

filterSearchInput.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    document.querySelectorAll('.filter-option').forEach(opt => {
        const label = opt.querySelector('.option-label').textContent.toLowerCase();
        opt.style.display = label.includes(q) ? 'flex' : 'none';
    });
});

document.addEventListener('click', (e) => {
    if (!filterDropdown.contains(e.target) && !e.target.closest('.filter-btn')) {
        filterDropdown.classList.remove('show');
    }
});

// ==================================================================
// ================== أزرار عامة (لوحة التحكم) ======================
// ==================================================================
clearFiltersBtn.addEventListener('click', () => {
    activeFilters = {};
    searchInput.value = '';
    compareAccountsSet = null;
    compareResult = null;
    dashboardPage = 1;

    document.querySelectorAll('.filter-btn:not([data-table="problems"]):not([data-table="cards"]):not([data-table="balances"])').forEach(btn => {
        btn.classList.remove('active');
    });

    const bar = document.getElementById('compareFilterBar');
    if (bar) bar.remove();

    const infoBar = document.getElementById('compareInfoBar');
    if (infoBar) infoBar.remove();

    renderTable();
});

searchInput.addEventListener('input', debounce(() => {
    dashboardPage = 1;
    renderTable();
}, 250));

refreshBtn.addEventListener('click', () => {
    refreshBtn.textContent = '⏳ جاري التحديث...';
    refreshBtn.disabled = true;

    setTimeout(() => {
        updateStats();
        renderTable();
        refreshBtn.textContent = '🔄 تحديث';
        refreshBtn.disabled = false;
    }, 800);
});

const problemsCardEl = document.getElementById('problemsCard');
if (problemsCardEl) {
    problemsCardEl.addEventListener('click', () => {
        const problemsNavItem = document.querySelector('.nav-item[data-page="problems"]');
        if (problemsNavItem) problemsNavItem.click();
    });
}

// ==================================================================
// ================== استيراد Excel (لوحة التحكم) ==================
// ==================================================================
importBtn.addEventListener('click', () => {
    excelInput.click();
});

excelInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (event) => {
        try {
            const data = new Uint8Array(event.target.result);

            const workbook = XLSX.read(data, {
                type: 'array',
                cellDates: true,
                cellNF: false,
                cellText: false,
                raw: true
            });

            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];

            const rows = XLSX.utils.sheet_to_json(sheet, {
                header: 1,
                raw: true,
                defval: '',
                blankrows: false
            });

            if (rows.length < 2) {
                alert('⚠️ الملف فاضي أو مش فيه بيانات');
                return;
            }

            const expectedColumns = [
                'name', 'account', 'card', 'nationalId',
                'phone', 'supplier', 'depositDate', 'depositValue',
                'note', 'withdrawn'
            ];

            const dataRows = rows.slice(1);

            const importedData = dataRows
                .filter(row => row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== ''))
                .map(row => {
                    const obj = {
                        comment: '', cardIssueReason: '', newCardNumber: '',
                        sendDate: '', receiveDate: '', cardIssued: 'لا',
                        files: []
                    };
                    expectedColumns.forEach((col, i) => {
                        const rawValue = row[i];

                        if (col === 'depositValue') {
                            obj[col] = excelCellToNumber(rawValue);
                        } else if (col === 'withdrawn') {
                            const v = String(rawValue ?? '').trim();
                            if (v === 'نعم' || v === 'yes' || v === 'Yes' || v === 'true' || v === '1') obj[col] = 'نعم';
                            else obj[col] = 'لا';
                        } else {
                            obj[col] = excelCellToString(rawValue);
                        }
                    });

                    obj.cardIssueReason = obj.note || '';
                    obj._id = generateRowId();

                    return obj;
                });

            if (importedData.length === 0) {
                alert('⚠️ لم يتم العثور على بيانات صالحة في الملف');
                return;
            }

            transactionsData.length = 0;
            transactionsData.push(...importedData);
            rebuildRowIndexMap();
            saveData();

            activeFilters = {};
            searchInput.value = '';
            compareAccountsSet = null;
            compareResult = null;
            dashboardPage = 1;

            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));

            const bar = document.getElementById('compareFilterBar');
            if (bar) bar.remove();

            const infoBar = document.getElementById('compareInfoBar');
            if (infoBar) infoBar.remove();

            updateStats();
            renderAllTables();

            alert(`✅ تم استيراد ${importedData.length} معاملة بنجاح`);

        } catch (error) {
            console.error(error);
            alert('❌ حدث خطأ أثناء قراءة الملف\nتأكد إن الملف بصيغة Excel صحيحة');
        }

        excelInput.value = '';
    };

    reader.readAsArrayBuffer(file);
});

// ==================================================================
// ================== استيراد Excel (صفحة إصدار البطاقات) ==========
// ==================================================================
const cardsImportBtn = document.getElementById('cardsImportBtn');
const cardsExcelInput = document.getElementById('cardsExcelInput');

if (cardsImportBtn) {
    cardsImportBtn.addEventListener('click', () => {
        cardsExcelInput.click();
    });
}

if (cardsExcelInput) {
    cardsExcelInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target.result);

                const workbook = XLSX.read(data, {
                    type: 'array',
                    cellDates: true,
                    cellNF: false,
                    cellText: false,
                    raw: true
                });

                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];

                const rows = XLSX.utils.sheet_to_json(sheet, {
                    header: 1,
                    raw: true,
                    defval: '',
                    blankrows: false
                });

                if (rows.length < 2) {
                    alert('⚠️ الملف فاضي أو مش فيه بيانات');
                    return;
                }

                const expectedColumns = [
                    'name', 'account', 'nationalId', 'phone', 'supplier',
                    'cardIssueReason', 'newCardNumber', 'sendDate', 'receiveDate', 'cardIssued'
                ];

                const dataRows = rows.slice(1);

                const importedData = dataRows
                    .filter(row => row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== ''))
                    .map(row => {
                        const obj = {
                            name: '', account: '', card: '', nationalId: '', phone: '',
                            supplier: '', depositDate: '', depositValue: 0, note: '', withdrawn: 'لا',
                            comment: '', cardIssueReason: '', newCardNumber: '',
                            sendDate: '', receiveDate: '', cardIssued: 'لا',
                            _id: generateRowId(), files: []
                        };

                        expectedColumns.forEach((col, i) => {
                            const rawValue = row[i];

                            if (col === 'cardIssued') {
                                const v = String(rawValue ?? '').trim();
                                if (v === 'نعم' || v === 'yes' || v === 'Yes' || v === 'true' || v === '1' || v === '✓ نعم') obj[col] = 'نعم';
                                else obj[col] = 'لا';
                            } else {
                                obj[col] = excelCellToString(rawValue);
                            }
                        });

                        if (!obj.cardIssueReason && obj.note) obj.cardIssueReason = obj.note;
                        if (obj.cardIssueReason && !obj.note) obj.note = `! ${obj.cardIssueReason}`;

                        return obj;
                    });

                if (importedData.length === 0) {
                    alert('⚠️ لم يتم العثور على بيانات صالحة في الملف');
                    return;
                }

                transactionsData.push(...importedData);
                rebuildRowIndexMap();
                saveData();

                updateStats();
                updateCardsStats();
                updateProblemsStats();
                renderAllTables();

                alert(`✅ تم استيراد ${importedData.length} بطاقة بنجاح`);

            } catch (error) {
                console.error(error);
                alert('❌ حدث خطأ أثناء قراءة الملف\nتأكد إن الملف بصيغة Excel صحيحة');
            }

            cardsExcelInput.value = '';
        };

        reader.readAsArrayBuffer(file);
    });
}

// ==================================================================
// ================== مسح كل البيانات ==============================
// ==================================================================
clearDataBtn.addEventListener('click', () => {
    if (transactionsData.length === 0) {
        alert('ℹ️ مفيش بيانات أصلاً');
        return;
    }

    const confirmed = confirm(
        `⚠️ هل أنت متأكد من حذف كل البيانات؟\n\n` +
        `عدد الصفوف اللي هتتحذف: ${transactionsData.length}\n` +
        `العملية دي مش هينفع تتراجع!`
    );

    if (!confirmed) return;

    transactionsData.length = 0;
    rebuildRowIndexMap();
    saveData();

    activeFilters = {};
    searchInput.value = '';
    compareAccountsSet = null;
    compareResult = null;
    problemsActiveFilters = {};
    problemsSearchQuery = '';
    cardsActiveFilters = {};
    cardsSearchQuery = '';
    dashboardPage = 1;
    problemsPage = 1;
    cardsPage = 1;

    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));

    const problemsSearch = document.getElementById('problemsSearchInput');
    if (problemsSearch) problemsSearch.value = '';

    const cardsSearch = document.getElementById('cardsSearchInput');
    if (cardsSearch) cardsSearch.value = '';

    const bar = document.getElementById('compareFilterBar');
    if (bar) bar.remove();

    const infoBar = document.getElementById('compareInfoBar');
    if (infoBar) infoBar.remove();

    updateStats();
    renderAllTables();

    alert('✅ تم مسح كل البيانات');
});

// ==================================================================
// ================== فلتر المقارنة =================================
// ==================================================================
compareBtn.addEventListener('click', () => {
    compareModal.classList.add('show');
    compareInput.value = '';
    compareInputCount.textContent = '0 رقم';
    compareInput.focus();
});

function closeCompareModal() {
    compareModal.classList.remove('show');
}

compareModalClose.addEventListener('click', closeCompareModal);
compareModal.addEventListener('click', (e) => {
    if (e.target === compareModal) closeCompareModal();
});

compareInput.addEventListener('input', () => {
    const lines = compareInput.value
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);
    compareInputCount.textContent = `${lines.length} رقم`;
});

compareClear.addEventListener('click', () => {
    compareInput.value = '';
    compareInputCount.textContent = '0 رقم';
    compareInput.focus();
});

compareRun.addEventListener('click', () => {
    const lines = compareInput.value
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);

    if (lines.length === 0) {
        alert('⚠️ من فضلك الصق الأرقام أولاً');
        return;
    }

    compareAccountsSet = new Set();
    lines.forEach(l => {
        const v = String(l).replace(/\s/g, '').trim();
        if (!v) return;
        compareAccountsSet.add(v);
        if (!v.startsWith('0')) compareAccountsSet.add('0' + v);
        if (v.startsWith('0') && v.length > 1) compareAccountsSet.add(v.slice(1));
    });

    const matchedNumbers = new Set();
    const unmatchedNumbers = [];

    const dataValues = new Set();
    transactionsData.forEach(row => {
        const acc = normalizeAccount(row.account);
        const nid = normalizeNationalId(row.nationalId);
        const crd = normalizeCard(row.card);
        const phn = normalizePhone(row.phone);

        if (acc) {
            dataValues.add(acc);
            if (acc.startsWith('0')) dataValues.add(acc.slice(1));
        }
        if (nid) dataValues.add(nid);
        if (crd) dataValues.add(crd);
        if (phn) {
            dataValues.add(phn);
            if (phn.startsWith('0')) dataValues.add(phn.slice(1));
        }
    });

    lines.forEach(l => {
        const v = String(l).replace(/\s/g, '').trim();
        if (!v) return;

        let isMatch = false;
        if (dataValues.has(v)) isMatch = true;
        if (!isMatch && !v.startsWith('0') && dataValues.has('0' + v)) isMatch = true;
        if (!isMatch && v.startsWith('0') && v.length > 1 && dataValues.has(v.slice(1))) isMatch = true;

        if (isMatch) matchedNumbers.add(v);
        else unmatchedNumbers.push(v);
    });

    compareResult = {
        total: lines.length,
        matched: matchedNumbers.size,
        unmatched: unmatchedNumbers
    };

    closeCompareModal();
    dashboardPage = 1;
    renderCompareBar();
    renderTable();
});

function renderCompareBar() {
    const oldBar = document.getElementById('compareFilterBar');
    if (oldBar) oldBar.remove();

    const oldInfo = document.getElementById('compareInfoBar');
    if (oldInfo) oldInfo.remove();

    if (!compareAccountsSet) return;

    const result = compareResult || { total: 0, matched: 0, unmatched: [] };

    const bar = document.createElement('div');
    bar.id = 'compareFilterBar';
    bar.className = 'compare-filter-bar';
    bar.innerHTML = `
        <span class="compare-bar-icon">🔍</span>
        <span class="compare-bar-text">
            فلتر المقارنة نشط — بيتم عرض 
            <strong id="compareBarCount">0</strong> 
            صف
        </span>
        <button class="btn btn-primary btn-sm" id="compareBarMarkWithdrawn" title="تعيين 'تم السحب = نعم' لكل الصفوف المعروضة">
            ✅ تطبيق السحب على الكل
        </button>
        <button class="btn btn-primary btn-sm" id="compareBarApplyNote" title="تطبيق ملاحظة أول صف على كل الصفوف المعروضة">
            📝 تطبيق الملاحظة على الكل
        </button>
        <button class="btn btn-danger btn-sm" id="compareBarDeleteFiltered" title="حذف الصفوف المعروضة فقط">
            🗑️ مسح المفلتر (<span id="compareBarDeleteCount">0</span>)
        </button>
        <button class="btn btn-danger btn-sm" id="compareBarClear">✕ إلغاء الفلتر</button>
    `;

    const tableContainer = document.querySelector('#dashboardView .table-container');
    if (tableContainer) {
        tableContainer.parentNode.insertBefore(bar, tableContainer);
    }

    const infoBar = document.createElement('div');
    infoBar.id = 'compareInfoBar';
    infoBar.className = 'compare-info-bar';
    infoBar.innerHTML = `
        <div class="compare-info-stats">
            <div class="compare-info-stat">
                <span class="compare-info-icon">📊</span>
                <div>
                    <div class="compare-info-label">إجمالي الأرقام</div>
                    <div class="compare-info-value">${result.total}</div>
                </div>
            </div>
            <div class="compare-info-stat success">
                <span class="compare-info-icon">✅</span>
                <div>
                    <div class="compare-info-label">موجودين</div>
                    <div class="compare-info-value">${result.matched}</div>
                </div>
            </div>
            <div class="compare-info-stat ${result.unmatched.length > 0 ? 'danger' : ''}">
                <span class="compare-info-icon">❌</span>
                <div>
                    <div class="compare-info-label">مش موجودين</div>
                    <div class="compare-info-value">${result.unmatched.length}</div>
                </div>
            </div>
        </div>
        ${result.unmatched.length > 0 ? `
            <button class="btn btn-ghost btn-sm" id="showUnmatchedBtn">
                👁️ عرض الأرقام الناقصة (${result.unmatched.length})
            </button>
            <button class="btn btn-ghost btn-sm" id="copyUnmatchedBtn">
                📋 نسخ الناقصة
            </button>
        ` : ''}
    `;

    bar.parentNode.insertBefore(infoBar, bar.nextSibling);

    document.getElementById('compareBarClear').addEventListener('click', () => {
        compareAccountsSet = null;
        compareResult = null;
        bar.remove();
        infoBar.remove();
        renderTable();
    });

    document.getElementById('compareBarMarkWithdrawn').addEventListener('click', markAllFilteredAsWithdrawn);
    document.getElementById('compareBarApplyNote').addEventListener('click', applyNoteToAll);
    document.getElementById('compareBarDeleteFiltered').addEventListener('click', deleteFilteredRows);

    const showBtn = document.getElementById('showUnmatchedBtn');
    const copyBtn = document.getElementById('copyUnmatchedBtn');

    if (showBtn) showBtn.addEventListener('click', showUnmatchedModal);

    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            if (result.unmatched.length === 0) return;
            const text = result.unmatched.join('\n');
            navigator.clipboard.writeText(text).then(() => {
                alert(`✅ تم نسخ ${result.unmatched.length} رقم ناقص`);
            }).catch(() => {
                alert('❌ فشل النسخ');
            });
        });
    }
}

// ==================================================================
// ================== تطبيق السحب على الكل ==========================
// ==================================================================
function markAllFilteredAsWithdrawn() {
    const visibleRows = getFilteredData();

    if (visibleRows.length === 0) {
        alert('⚠️ مفيش صفوف معروضة حاليًا');
        return;
    }

    const confirmed = confirm(
        `⚠️ هيتم تعيين "تم السحب = نعم" لـ ${visibleRows.length} صف\n\n` +
        `هل أنت متأكد؟`
    );

    if (!confirmed) return;

    let updatedCount = 0;
    visibleRows.forEach(row => {
        if (row.withdrawn !== 'نعم') {
            row.withdrawn = 'نعم';
            updatedCount++;
        }
    });

    if (updatedCount === 0) {
        alert('ℹ️ كل الصفوف المعروضة "تم السحب = نعم" بالفعل');
        return;
    }

    saveData();
    updateStats();
    renderAllTables();
    updateCompareBarCount();

    alert(`✅ تم تعيين "تم السحب = نعم" لـ ${updatedCount} صف`);
}

// ==================================================================
// ================== تطبيق الملاحظة على الكل =======================
// ==================================================================
function applyNoteToAll() {
    const visibleRows = getFilteredData();

    if (visibleRows.length === 0) {
        alert('⚠️ مفيش صفوف معروضة حاليًا');
        return;
    }

    const firstRow = visibleRows[0];
    const noteValue = (firstRow.note || '').trim();

    if (!noteValue) {
        alert('⚠️ أول صف في عمود الملاحظة فاضي — اكتب ملاحظة الأول');
        return;
    }

    const confirmed = confirm(
        `⚠️ هيتم تطبيق الملاحظة دي:\n\n` +
        `"${noteValue}"\n\n` +
        `على ${visibleRows.length} صف معروض.\n\n` +
        `هل أنت متأكد؟`
    );

    if (!confirmed) return;

    let updatedCount = 0;
    visibleRows.forEach(row => {
        if ((row.note || '').trim() !== noteValue) {
            row.note = noteValue;
            updatedCount++;
        }
    });

    if (updatedCount === 0) {
        alert('ℹ️ كل الصفوف المعروضة عندها نفس الملاحظة بالفعل');
        return;
    }

    saveData();
    updateStats();
    renderAllTables();
    updateCompareBarCount();

    alert(`✅ تم تطبيق الملاحظة على ${updatedCount} صف`);
}

// ==================================================================
// ================== مسح الصفوف المفلترة فقط =======================
// ==================================================================
function deleteFilteredRows() {
    const visibleRows = getFilteredData();

    if (visibleRows.length === 0) {
        alert('⚠️ مفيش صفوف معروضة حاليًا');
        return;
    }

    const confirmed = confirm(
        `⚠️ هيتم حذف ${visibleRows.length} صف (الصفوف المعروضة حاليًا فقط)\n\n` +
        `باقي البيانات هتفضل زي ما هي.\n\n` +
        `هل أنت متأكد؟`
    );

    if (!confirmed) return;

    const visibleIds = new Set(visibleRows.map(r => r._id));

    for (let i = transactionsData.length - 1; i >= 0; i--) {
        if (visibleIds.has(transactionsData[i]._id)) {
            transactionsData.splice(i, 1);
        }
    }

    rebuildRowIndexMap();
    saveData();

    if (compareAccountsSet) {
        compareAccountsSet = null;
        compareResult = null;

        const bar = document.getElementById('compareFilterBar');
        if (bar) bar.remove();

        const infoBar = document.getElementById('compareInfoBar');
        if (infoBar) infoBar.remove();
    }

    dashboardPage = 1;
    updateStats();
    renderAllTables();

    alert(`✅ تم حذف ${visibleRows.length} صف بنجاح`);
}

// ==================================================================
// ================== مودال الأرقام الناقصة =========================
// ==================================================================
function showUnmatchedModal() {
    if (!compareResult || compareResult.unmatched.length === 0) return;

    const old = document.getElementById('unmatchedModal');
    if (old) old.remove();

    const modal = document.createElement('div');
    modal.id = 'unmatchedModal';
    modal.className = 'modal-overlay show';
    modal.innerHTML = `
        <div class="modal compare-modal">
            <div class="modal-header">
                <h3>❌ الأرقام غير الموجودة (${compareResult.unmatched.length})</h3>
                <button class="modal-close" id="unmatchedClose">✕</button>
            </div>
            <div class="compare-body">
                <div class="unmatched-list" id="unmatchedList"></div>
                <div class="compare-input-footer" style="margin-top: 16px;">
                    <span class="compare-count">${compareResult.unmatched.length} رقم</span>
                    <div class="compare-input-actions">
                        <button class="btn btn-ghost btn-sm" id="unmatchedCopyAll">📋 نسخ الكل</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const listEl = modal.querySelector('#unmatchedList');
    listEl.innerHTML = compareResult.unmatched.map(num => `
        <div class="unmatched-item">
            <span class="unmatched-item-icon">❌</span>
            <span class="unmatched-item-text">${escapeHtml(num)}</span>
        </div>
    `).join('');

    modal.querySelector('#unmatchedClose').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    modal.querySelector('#unmatchedCopyAll').addEventListener('click', () => {
        const text = compareResult.unmatched.join('\n');
        navigator.clipboard.writeText(text).then(() => {
            alert(`✅ تم نسخ ${compareResult.unmatched.length} رقم`);
        }).catch(() => {
            alert('❌ فشل النسخ');
        });
    });
}

function updateCompareBarCount() {
    const count = getFilteredData().length;
    const el = document.getElementById('compareBarCount');
    if (el) el.textContent = count;
    const delCount = document.getElementById('compareBarDeleteCount');
    if (delCount) delCount.textContent = count;
}

// ==================================================================
// ================== صفحة "مشاكلي" =================================
// ==================================================================
function getProblemsData() {
    return transactionsData.filter(row => {
        if (!isProblemNote(row.note)) return false;

        const q = problemsSearchQuery.trim();
        if (q && !searchMatches(q, row)) return false;

        for (const col in problemsActiveFilters) {
            const selected = problemsActiveFilters[col];
            if (!selected || selected.length === 0) continue;
            if (!matchesFilterValue(row[col], selected)) return false;
        }

        return true;
    });
}

function renderProblemsTable() {
    const problemsBody = document.getElementById('problemsTableBody');
    if (!problemsBody) return;

    const data = getProblemsData();

    if (data.length === 0) {
        problemsBody.innerHTML = `
            <tr>
                <td colspan="11" style="text-align:center; padding:40px; color:var(--text-muted);">
                    لا توجد مشاكل مطابقة
                </td>
            </tr>`;
        updatePaginationControls('problems', 0, 1, PAGE_SIZE);
        updateProblemsFloatingScrollbar();
        return;
    }

    const totalPages = Math.ceil(data.length / PAGE_SIZE);
    if (problemsPage > totalPages) problemsPage = totalPages;
    if (problemsPage < 1) problemsPage = 1;

    const start = (problemsPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageData = data.slice(start, end);

    const fragment = document.createDocumentFragment();

    pageData.forEach((row) => {
        const originalIndex = findRowIndexById(row._id);

        const tr = document.createElement('tr');
        tr.dataset.index = originalIndex;
        tr.dataset.rowId = row._id;
        tr.className = 'problem-row';

        tr.innerHTML = `
            <td>${row.name || ''}</td>
            <td style="font-family:monospace;">${normalizeAccount(row.account)}</td>
            <td style="font-family:monospace; color:var(--text-secondary);">${maskCard(row.card)}</td>
            <td style="font-family:monospace; color:var(--text-secondary);">${normalizeNationalId(row.nationalId)}</td>
            <td style="font-family:monospace;">${normalizePhone(row.phone)}</td>
            <td>${row.supplier || ''}</td>
            <td>${row.depositDate || ''}</td>
            <td style="font-weight:800; color:${(Number(row.depositValue) || 0) > 0 ? 'var(--success)' : 'var(--danger)'};">
                ${formatNumber(row.depositValue)} ج.م
            </td>
            <td style="color:var(--warning); font-size:13px; font-weight:800;">
                ${buildNoteCell(row, true)}
            </td>
            <td>${withdrawnBadge(row.withdrawn)}</td>
            <td>
                <div class="actions-cell">
                    ${buildFilesButton(row)}
                    <button class="icon-btn" data-action="comment" data-index="${originalIndex}" title="إضافة/تعديل تعليق">💬</button>
                    <button class="icon-btn delete" data-action="delete" data-index="${originalIndex}" title="حذف">🗑️</button>
                </div>
            </td>
        `;

        fragment.appendChild(tr);
    });

    problemsBody.innerHTML = '';
    problemsBody.appendChild(fragment);

    updatePaginationControls('problems', data.length, problemsPage, PAGE_SIZE);
    updateProblemsFloatingScrollbar();
}

function updateProblemsStats() {
    const problems = transactionsData.filter(row => isProblemNote(row.note));
    const total = problems.length;
    const notWithdrawn = problems.filter(r => r.withdrawn !== 'نعم').length;
    const withdrawn = problems.filter(r => r.withdrawn === 'نعم').length;
    const totalValue = problems.reduce((sum, r) => sum + (Number(r.depositValue) || 0), 0);

    const el1 = document.getElementById('problemsTotalCount');
    const el2 = document.getElementById('problemsNotWithdrawn');
    const el3 = document.getElementById('problemsWithdrawn');
    const el4 = document.getElementById('problemsTotalValue');

    if (el1) el1.textContent = total;
    if (el2) el2.textContent = notWithdrawn;
    if (el3) el3.textContent = withdrawn;
    if (el4) el4.textContent = formatNumber(totalValue);
}

// ==================================================================
// ================== أحداث صفحة "مشاكلي" ===========================
// ==================================================================
document.addEventListener('DOMContentLoaded', () => {
    const problemsSearchInput = document.getElementById('problemsSearchInput');
    if (problemsSearchInput) {
        problemsSearchInput.addEventListener('input', debounce((e) => {
            problemsSearchQuery = e.target.value.trim();
            problemsPage = 1;
            renderProblemsTable();
        }, 250));
    }

    const problemsRefreshBtn = document.getElementById('problemsRefreshBtn');
    if (problemsRefreshBtn) {
        problemsRefreshBtn.addEventListener('click', () => {
            updateProblemsStats();
            renderProblemsTable();
        });
    }

    const problemsClearBtn = document.getElementById('problemsClearFiltersBtn');
    if (problemsClearBtn) {
        problemsClearBtn.addEventListener('click', () => {
            problemsActiveFilters = {};
            problemsSearchQuery = '';
            problemsCurrentFilterCol = null;
            problemsPage = 1;

            const searchEl = document.getElementById('problemsSearchInput');
            if (searchEl) searchEl.value = '';

            document.querySelectorAll('.filter-btn[data-table="problems"]').forEach(btn => {
                btn.classList.remove('active');
            });

            renderProblemsTable();
        });
    }

    document.querySelectorAll('.filter-btn[data-table="problems"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();

            const col = btn.dataset.col;
            problemsCurrentFilterCol = col;

            filterDropdown.classList.remove('show');

            const problemsData = transactionsData.filter(r => isProblemNote(r.note));
            buildFilterOptions(col, problemsData, problemsActiveFilters);

            const rect = btn.getBoundingClientRect();
            const dropdownWidth = 240;
            let left = rect.left;
            if (left + dropdownWidth > window.innerWidth) {
                left = window.innerWidth - dropdownWidth - 10;
            }

            filterDropdown.style.top = (rect.bottom + 6) + 'px';
            filterDropdown.style.left = left + 'px';
            filterDropdown.classList.add('show');

            filterSearchInput.value = '';
            filterSearchInput.focus();

            const newApply = filterApply.cloneNode(true);
            const newClear = filterClear.cloneNode(true);
            filterApply.parentNode.replaceChild(newApply, filterApply);
            filterClear.parentNode.replaceChild(newClear, filterClear);

            document.getElementById('filterApply').addEventListener('click', () => {
                const selectedVals = [];
                document.querySelectorAll('.filter-option input[type="checkbox"]:checked').forEach(cb => {
                    selectedVals.push(cb.value);
                });

                if (selectedVals.length === 0) {
                    delete problemsActiveFilters[col];
                } else {
                    problemsActiveFilters[col] = selectedVals;
                }

                if (problemsActiveFilters[col] && problemsActiveFilters[col].length > 0) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }

                filterDropdown.classList.remove('show');
                problemsPage = 1;
                renderProblemsTable();
            });

            document.getElementById('filterClear').addEventListener('click', () => {
                delete problemsActiveFilters[col];
                btn.classList.remove('active');
                filterDropdown.classList.remove('show');
                problemsPage = 1;
                renderProblemsTable();
            });
        });
    });
});

// ==================================================================
// ================== صفحة "إصدار البطاقات" =========================
// ==================================================================
function getCardsData() {
    return transactionsData.filter(row => {
        if (!isCardIssueRow(row)) return false;

        const q = cardsSearchQuery.trim();
        if (q && !searchMatches(q, row)) return false;

        for (const col in cardsActiveFilters) {
            const selected = cardsActiveFilters[col];
            if (!selected || selected.length === 0) continue;

            let value;
            if (col === 'cardIssueReason') value = row.cardIssueReason || row.note || '';
            else if (col === 'newCardNumber') value = row.newCardNumber || '';
            else if (col === 'sendDate') value = row.sendDate || '';
            else if (col === 'receiveDate') value = row.receiveDate || '';
            else if (col === 'cardIssued') value = row.cardIssued || 'لا';
            else value = row[col];

            if (!matchesFilterValue(value, selected)) return false;
        }

        return true;
    });
}

function renderCardsTable() {
    const cardsBody = document.getElementById('cardsTableBody');
    if (!cardsBody) return;

    const data = getCardsData();

    if (data.length === 0) {
        cardsBody.innerHTML = `
            <tr>
                <td colspan="11" style="text-align:center; padding:40px; color:var(--text-muted);">
                    لا توجد بطاقات مطابقة
                </td>
            </tr>`;
        updatePaginationControls('cards', 0, 1, PAGE_SIZE);
        updateCardsFloatingScrollbar();
        return;
    }

    const totalPages = Math.ceil(data.length / PAGE_SIZE);
    if (cardsPage > totalPages) cardsPage = totalPages;
    if (cardsPage < 1) cardsPage = 1;

    const start = (cardsPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageData = data.slice(start, end);

    const fragment = document.createDocumentFragment();

    pageData.forEach((row) => {
        const originalIndex = findRowIndexById(row._id);
        ensureCardFields(row);

        const reasonText = (row.cardIssueReason || row.note || '').trim();
        let reasonBadge = '';

        if (isReadyReason(reasonText)) {
            reasonBadge = `<span class="badge" style="background:rgba(16,185,129,0.15); color:var(--success);">✅ ${escapeHtml(reasonText) || 'حساب جاهز'}</span>`;
        } else if (isNeedOpenReason(reasonText)) {
            reasonBadge = `<span class="badge" style="background:rgba(239,68,68,0.15); color:var(--danger);">🆕 ${escapeHtml(reasonText) || 'فتح حساب'}</span>`;
        } else {
            reasonBadge = `<span class="badge" style="background:rgba(139,92,246,0.15); color:#a78bfa;">💳 ${escapeHtml(reasonText) || 'تحتاج إصدار'}</span>`;
        }

        const newCardDisplay = row.newCardNumber
            ? `<span style="font-family:monospace; color:var(--success); font-weight:700;">${escapeHtml(row.newCardNumber)}</span>`
            : '<span style="color:var(--text-muted); font-size:11px;">—</span>';

        const issued = row.cardIssued === 'نعم' || row.withdrawn === 'نعم';
        const issuedBadge = issued
            ? '<span class="badge active">✓ نعم</span>'
            : '<span class="badge pending">✗ لا</span>';

        const tr = document.createElement('tr');
        tr.dataset.index = originalIndex;
        tr.dataset.rowId = row._id;
        tr.className = 'card-issue-row';

        tr.innerHTML = `
            <td>${row.name || ''}</td>
            <td style="font-family:monospace;">${normalizeAccount(row.account)}</td>
            <td style="font-family:monospace; color:var(--text-secondary);">${normalizeNationalId(row.nationalId)}</td>
            <td style="font-family:monospace;">${normalizePhone(row.phone)}</td>
            <td>${row.supplier || ''}</td>
            <td>${reasonBadge}</td>
            <td>${newCardDisplay}</td>
            <td class="date-cell">${row.sendDate || '<span style="color:var(--text-muted); font-size:11px;">—</span>'}</td>
            <td class="date-cell">${row.receiveDate || '<span style="color:var(--text-muted); font-size:11px;">—</span>'}</td>
            <td>${issuedBadge}</td>
            <td>
                <div class="actions-cell">
                    ${buildFilesButton(row)}
                    <button class="icon-btn" data-action="comment" data-index="${originalIndex}" title="إضافة/تعديل تعليق">💬</button>
                    <button class="icon-btn" data-action="mark-received" data-index="${originalIndex}" title="تحديد كمستلمة">📥</button>
                    <button class="icon-btn delete" data-action="delete" data-index="${originalIndex}" title="حذف">🗑️</button>
                </div>
            </td>
        `;

        fragment.appendChild(tr);
    });

    cardsBody.innerHTML = '';
    cardsBody.appendChild(fragment);

    updatePaginationControls('cards', data.length, cardsPage, PAGE_SIZE);
    updateCardsFloatingScrollbar();
}

function updateCardsStats() {
    const cards = transactionsData.filter(row => isCardIssueRow(row));
    const total = cards.length;

    let needOpen = 0;
    let ready = 0;

    cards.forEach(r => {
        const text = getCardIssueReasonText(r);
        if (isReadyReason(text)) ready++;
        else if (isNeedOpenReason(text)) needOpen++;
    });

    const issued = cards.filter(r => r.cardIssued === 'نعم' || r.withdrawn === 'نعم').length;

    const el1 = document.getElementById('cardsTotalCount');
    const el2 = document.getElementById('cardsBurned');
    const el3 = document.getElementById('cardsMissing');
    const el4 = document.getElementById('cardsIssued');

    if (el1) el1.textContent = total;
    if (el2) el2.textContent = needOpen;
    if (el3) el3.textContent = ready;
    if (el4) el4.textContent = issued;

    const navBadge = document.getElementById('navCardsCount');
    if (navBadge) {
        navBadge.textContent = total;
        navBadge.style.display = total > 0 ? 'inline-flex' : 'none';
    }
}

// ==================================================================
// ================== أحداث صفحة "إصدار البطاقات" ==================
// ==================================================================
document.addEventListener('DOMContentLoaded', () => {
    const cardsSearchInput = document.getElementById('cardsSearchInput');
    if (cardsSearchInput) {
        cardsSearchInput.addEventListener('input', debounce((e) => {
            cardsSearchQuery = e.target.value.trim();
            cardsPage = 1;
            renderCardsTable();
        }, 250));
    }

    const cardsRefreshBtn = document.getElementById('cardsRefreshBtn');
    if (cardsRefreshBtn) {
        cardsRefreshBtn.addEventListener('click', () => {
            updateCardsStats();
            renderCardsTable();
        });
    }

    const cardsClearBtn = document.getElementById('cardsClearFiltersBtn');
    if (cardsClearBtn) {
        cardsClearBtn.addEventListener('click', () => {
            cardsActiveFilters = {};
            cardsSearchQuery = '';
            cardsCurrentFilterCol = null;
            cardsPage = 1;

            const searchEl = document.getElementById('cardsSearchInput');
            if (searchEl) searchEl.value = '';

            document.querySelectorAll('.filter-btn[data-table="cards"]').forEach(btn => {
                btn.classList.remove('active');
            });

            renderCardsTable();
        });
    }

    const addCardBtn = document.getElementById('addCardBtn');
    if (addCardBtn) {
        addCardBtn.addEventListener('click', addNewCard);
    }

    document.querySelectorAll('.filter-btn[data-table="cards"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();

            const col = btn.dataset.col;
            cardsCurrentFilterCol = col;

            filterDropdown.classList.remove('show');

            const cardsData = transactionsData.filter(r => isCardIssueRow(r));
            buildFilterOptions(col, cardsData, cardsActiveFilters);

            const rect = btn.getBoundingClientRect();
            const dropdownWidth = 240;
            let left = rect.left;
            if (left + dropdownWidth > window.innerWidth) {
                left = window.innerWidth - dropdownWidth - 10;
            }

            filterDropdown.style.top = (rect.bottom + 6) + 'px';
            filterDropdown.style.left = left + 'px';
            filterDropdown.classList.add('show');

            filterSearchInput.value = '';
            filterSearchInput.focus();

            const newApply = filterApply.cloneNode(true);
            const newClear = filterClear.cloneNode(true);
            filterApply.parentNode.replaceChild(newApply, filterApply);
            filterClear.parentNode.replaceChild(newClear, filterClear);

            document.getElementById('filterApply').addEventListener('click', () => {
                const selectedVals = [];
                document.querySelectorAll('.filter-option input[type="checkbox"]:checked').forEach(cb => {
                    selectedVals.push(cb.value);
                });

                if (selectedVals.length === 0) {
                    delete cardsActiveFilters[col];
                } else {
                    cardsActiveFilters[col] = selectedVals;
                }

                if (cardsActiveFilters[col] && cardsActiveFilters[col].length > 0) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }

                filterDropdown.classList.remove('show');
                cardsPage = 1;
                renderCardsTable();
            });

            document.getElementById('filterClear').addEventListener('click', () => {
                delete cardsActiveFilters[col];
                btn.classList.remove('active');
                filterDropdown.classList.remove('show');
                cardsPage = 1;
                renderCardsTable();
            });
        });
    });
});

// ==================================================================
// ================== إضافة بطاقة جديدة =============================
// ==================================================================
function addNewCard() {
    const name = prompt('👤 اسم العميل:');
    if (!name || !name.trim()) return;

    const account = prompt('🔢 رقم الحساب:') || '';
    const nationalId = prompt('🆔 الرقم الوطني:') || '';
    const phone = prompt('📱 رقم الهاتف:') || '';
    const supplier = prompt('🏢 اسم المورد:') || '';
    const reason = prompt(
        '📌 حالة الحساب:\n' +
        '(اكتب: فتح حساب / حساب جاهز / كود 14 / صلاحية / بطاقة عند المورد ...)',
        'فتح حساب'
    ) || 'فتح حساب';
    const newCardNumber = prompt('💳 رقم البطاقة التي صدرت (اتركه فارغ لو لسه):') || '';
    const sendDate = prompt('📤 تاريخ الإرسال (مثال: 2026-01-15):') || '';
    const receiveDate = prompt('📥 تاريخ الاستلام (اتركه فارغ لو لسه):') || '';

    const newRow = {
        name: name.trim(),
        account: account.trim(),
        card: '',
        nationalId: nationalId.trim(),
        phone: phone.trim(),
        supplier: supplier.trim(),
        depositDate: new Date().toISOString().split('T')[0],
        depositValue: 0,
        note: `! ${reason.trim()}`,
        cardIssueReason: reason.trim(),
        newCardNumber: newCardNumber.trim(),
        sendDate: sendDate.trim(),
        receiveDate: receiveDate.trim(),
        withdrawn: 'لا',
        comment: '',
        cardIssued: receiveDate.trim() ? 'نعم' : 'لا',
        _id: generateRowId(),
        files: []
    };

    transactionsData.push(newRow);
    rebuildRowIndexMap();
    saveData();

    updateStats();
    updateCardsStats();
    updateProblemsStats();
    renderAllTables();

    alert('✅ تم إضافة البطاقة بنجاح');
}

// ==================================================================
// ================== ✅ صفحة "رصيد الدينار & دولار" ================
// ==================================================================

function getBalancesData() {
    return balancesData.filter(row => {
        if (window.__showOnlyConflicts) {
            const c = (row.comment || '').trim();
            if (!(c.includes('⚠️') || c.includes('ℹ️'))) return false;
        }

        const q = balancesSearchQuery.trim();
        if (q && !searchMatches(q, row)) return false;

        for (const col in balancesActiveFilters) {
            const selected = balancesActiveFilters[col];
            if (!selected || selected.length === 0) continue;
            if (!matchesFilterValue(row[col], selected)) return false;
        }

        return true;
    });
}

function renderBalancesTable() {
    const balancesBody = document.getElementById('balancesTableBody');
    if (!balancesBody) return;

    const data = getBalancesData();

    if (data.length === 0) {
        balancesBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; padding:40px; color:var(--text-muted);">
                    لا توجد بيانات مطابقة — استورد شيت Excel أو أضف سجل جديد
                </td>
            </tr>`;
        updatePaginationControls('balances', 0, 1, PAGE_SIZE);
        updateBalancesFloatingScrollbar();
        return;
    }

    const totalPages = Math.ceil(data.length / PAGE_SIZE);
    if (balancesPage > totalPages) balancesPage = totalPages;
    if (balancesPage < 1) balancesPage = 1;

    const start = (balancesPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageData = data.slice(start, end);

    const fragment = document.createDocumentFragment();

    pageData.forEach((row) => {
        const originalIndex = findBalanceRowIndexById(row._id);
        const dinar = Number(row.dinarBalance) || 0;
        const dollar = Number(row.dollarBalance) || 0;

        const comment = row.comment ? String(row.comment).trim() : '';
        const hasComment = comment.length > 0;

        const tr = document.createElement('tr');
        tr.dataset.index = originalIndex;
        tr.dataset.rowId = row._id;

        if (hasComment) {
            tr.className = 'balance-conflict-row';
        }

        tr.innerHTML = `
            <td>${row.name || ''}</td>
            <td style="font-family:monospace;">${normalizeAccount(row.account)}</td>
            <td style="font-family:monospace; color:var(--text-secondary);">${normalizeNationalId(row.nationalId)}</td>
            <td style="font-weight:800; color:${dinar > 0 ? 'var(--success)' : 'var(--text-muted)'};">
                ${formatNumber(dinar)} د.ل
            </td>
            <td style="font-weight:800; color:${dollar > 0 ? '#60a5fa' : 'var(--text-muted)'};">
                $ ${formatNumber(dollar)}
            </td>
            <td style="color:${hasComment ? 'var(--warning)' : 'var(--text-muted)'}; font-size:12px; font-weight:${hasComment ? '700' : '500'}; max-width:280px; white-space:normal; line-height:1.5;">
                ${hasComment
                    ? `<span class="note-with-tooltip" data-comment="${escapeHtml(comment)}" title="${escapeHtml(comment)}">⚠️ ${escapeHtml(comment.length > 60 ? comment.slice(0, 60) + '...' : comment)}</span>`
                    : '—'}
            </td>
            <td>
                <div class="actions-cell">
                    <button class="icon-btn" data-action="comment" data-index="${originalIndex}" title="إضافة/تعديل تعليق">💬</button>
                    <button class="icon-btn delete" data-action="delete" data-index="${originalIndex}" title="حذف">🗑️</button>
                </div>
            </td>
        `;

        fragment.appendChild(tr);
    });

    balancesBody.innerHTML = '';
    balancesBody.appendChild(fragment);

    updatePaginationControls('balances', data.length, balancesPage, PAGE_SIZE);
    updateBalancesFloatingScrollbar();
}

function updateBalancesStats() {
    const data = balancesData;
    const totalDinar = data.reduce((sum, r) => sum + (Number(r.dinarBalance) || 0), 0);
    const totalDollar = data.reduce((sum, r) => sum + (Number(r.dollarBalance) || 0), 0);
    const count = data.length;

    const conflicts = data.filter(r => {
        const c = (r.comment || '').trim();
        return c.includes('⚠️') || c.includes('ℹ️');
    }).length;

    const el1 = document.getElementById('balanceDinarTotal');
    const el2 = document.getElementById('balanceDollarTotal');
    const el3 = document.getElementById('balanceCustomersCount');
    const el4 = document.getElementById('balanceConflictsCount');

    if (el1) el1.textContent = formatNumber(totalDinar);
    if (el2) el2.textContent = formatNumber(totalDollar);
    if (el3) el3.textContent = count;
    if (el4) el4.textContent = conflicts;
}

function showConflictsFilterBar(count) {
    const oldBar = document.getElementById('conflictsFilterBar');
    if (oldBar) oldBar.remove();

    const bar = document.createElement('div');
    bar.id = 'conflictsFilterBar';
    bar.className = 'compare-filter-bar';
    bar.style.cssText = 'margin-bottom: 14px;';
    bar.innerHTML = `
        <span class="compare-bar-icon">⚠️</span>
        <span class="compare-bar-text">
            بيتم عرض <strong>${count}</strong> صف فيه تعارض بآخر 6 أرقام
        </span>
        <button class="btn btn-danger btn-sm" id="conflictsClearBtn">✕ إلغاء الفلتر</button>
    `;

    const tableContainer = document.querySelector('#balancesView .table-container');
    if (tableContainer) {
        tableContainer.parentNode.insertBefore(bar, tableContainer);
    }

    document.getElementById('conflictsClearBtn').addEventListener('click', () => {
        window.__showOnlyConflicts = false;
        bar.remove();
        renderBalancesTable();
    });
}

// ==================================================================
// ================== أحداث صفحة "رصيد الدينار & دولار" =============
// ==================================================================
document.addEventListener('DOMContentLoaded', () => {
    const balancesSearchInput = document.getElementById('balancesSearchInput');
    if (balancesSearchInput) {
        balancesSearchInput.addEventListener('input', debounce((e) => {
            balancesSearchQuery = e.target.value.trim();
            balancesPage = 1;
            renderBalancesTable();
        }, 250));
    }

    const balancesRefreshBtn = document.getElementById('balancesRefreshBtn');
    if (balancesRefreshBtn) {
        balancesRefreshBtn.addEventListener('click', () => {
            updateBalancesStats();
            renderBalancesTable();
        });
    }

    const balancesClearBtn = document.getElementById('balancesClearFiltersBtn');
    if (balancesClearBtn) {
        balancesClearBtn.addEventListener('click', () => {
            balancesActiveFilters = {};
            balancesSearchQuery = '';
            balancesCurrentFilterCol = null;
            balancesPage = 1;

            window.__showOnlyConflicts = false;
            const conflictsBar = document.getElementById('conflictsFilterBar');
            if (conflictsBar) conflictsBar.remove();

            const searchEl = document.getElementById('balancesSearchInput');
            if (searchEl) searchEl.value = '';

            document.querySelectorAll('.filter-btn[data-table="balances"]').forEach(btn => {
                btn.classList.remove('active');
            });

            renderBalancesTable();
        });
    }

    const clearBalancesDataBtn = document.getElementById('clearBalancesDataBtn');
    if (clearBalancesDataBtn) {
        clearBalancesDataBtn.addEventListener('click', () => {
            if (balancesData.length === 0) {
                alert('ℹ️ مفيش بيانات أرصدة أصلاً');
                return;
            }

            const confirmed = confirm(
                `⚠️ هل أنت متأكد من حذف كل بيانات الأرصدة؟\n\n` +
                `عدد السجلات اللي هتتحذف: ${balancesData.length}\n` +
                `العملية دي مش هينفع تتراجع!`
            );

            if (!confirmed) return;

            balancesData.length = 0;
            rebuildBalancesRowIndexMap();
            saveBalancesData();

            balancesActiveFilters = {};
            balancesSearchQuery = '';
            balancesCurrentFilterCol = null;
            balancesPage = 1;

            window.__showOnlyConflicts = false;
            const conflictsBar = document.getElementById('conflictsFilterBar');
            if (conflictsBar) conflictsBar.remove();

            const searchEl = document.getElementById('balancesSearchInput');
            if (searchEl) searchEl.value = '';

            document.querySelectorAll('.filter-btn[data-table="balances"]').forEach(btn => {
                btn.classList.remove('active');
            });

            updateBalancesStats();
            renderBalancesTable();
            updateBalancesFloatingScrollbar();

            alert('✅ تم مسح كل بيانات الأرصدة');
        });
    }

    const balanceConflictsCardEl = document.getElementById('balanceConflictsCard');
    if (balanceConflictsCardEl) {
        balanceConflictsCardEl.addEventListener('click', () => {
            const balancesNavItem = document.querySelector('.nav-item[data-page="balances"]');
            if (balancesNavItem) balancesNavItem.click();

            const conflictRows = balancesData.filter(r => {
                const c = (r.comment || '').trim();
                return c.includes('⚠️') || c.includes('ℹ️');
            });

            if (conflictRows.length === 0) {
                alert('ℹ️ مفيش تعارضات حالياً بآخر 6 أرقام');
                return;
            }

            balancesActiveFilters = {};
            window.__showOnlyConflicts = true;

            balancesSearchQuery = '';
            const searchEl = document.getElementById('balancesSearchInput');
            if (searchEl) searchEl.value = '';

            document.querySelectorAll('.filter-btn[data-table="balances"]').forEach(btn => {
                btn.classList.remove('active');
            });

            balancesPage = 1;
            renderBalancesTable();

            showConflictsFilterBar(conflictRows.length);
        });
    }

    document.querySelectorAll('.filter-btn[data-table="balances"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();

            const col = btn.dataset.col;
            balancesCurrentFilterCol = col;

            filterDropdown.classList.remove('show');

            buildFilterOptions(col, balancesData, balancesActiveFilters);

            const rect = btn.getBoundingClientRect();
            const dropdownWidth = 240;
            let left = rect.left;
            if (left + dropdownWidth > window.innerWidth) {
                left = window.innerWidth - dropdownWidth - 10;
            }

            filterDropdown.style.top = (rect.bottom + 6) + 'px';
            filterDropdown.style.left = left + 'px';
            filterDropdown.classList.add('show');

            filterSearchInput.value = '';
            filterSearchInput.focus();

            const newApply = filterApply.cloneNode(true);
            const newClear = filterClear.cloneNode(true);
            filterApply.parentNode.replaceChild(newApply, filterApply);
            filterClear.parentNode.replaceChild(newClear, filterClear);

            document.getElementById('filterApply').addEventListener('click', () => {
                const selectedVals = [];
                document.querySelectorAll('.filter-option input[type="checkbox"]:checked').forEach(cb => {
                    selectedVals.push(cb.value);
                });

                if (selectedVals.length === 0) {
                    delete balancesActiveFilters[col];
                } else {
                    balancesActiveFilters[col] = selectedVals;
                }

                if (balancesActiveFilters[col] && balancesActiveFilters[col].length > 0) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }

                filterDropdown.classList.remove('show');
                balancesPage = 1;
                renderBalancesTable();
            });

            document.getElementById('filterClear').addEventListener('click', () => {
                delete balancesActiveFilters[col];
                btn.classList.remove('active');
                filterDropdown.classList.remove('show');
                balancesPage = 1;
                renderBalancesTable();
            });
        });
    });

    // ============ ✅ استيراد شيت الدينار ==========
    const importDinarBtn = document.getElementById('importDinarBtn');
    const dinarExcelInput = document.getElementById('dinarExcelInput');

    if (importDinarBtn) {
        importDinarBtn.addEventListener('click', () => {
            dinarExcelInput.click();
        });
    }

    if (dinarExcelInput) {
        dinarExcelInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();

            reader.onload = (event) => {
                try {
                    const data = new Uint8Array(event.target.result);

                    const workbook = XLSX.read(data, {
                        type: 'array',
                        cellDates: true,
                        cellNF: false,
                        cellText: false,
                        raw: true
                    });

                    const sheet = workbook.Sheets[workbook.SheetNames[0]];

                    const rows = XLSX.utils.sheet_to_json(sheet, {
                        header: 1,
                        raw: true,
                        defval: '',
                        blankrows: false
                    });

                    if (rows.length < 2) {
                        alert('⚠️ الملف فاضي أو مش فيه بيانات');
                        return;
                    }

                    const dataRows = rows.slice(1);

                    const parsedRows = dataRows
                        .filter(row => row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== ''))
                        .map(row => {
                            const name = excelCellToString(row[0]);
                            const account = excelCellToString(row[1]);
                            const nationalId = excelCellToString(row[2]);
                            const balance = excelCellToNumber(row[3]);
                            return { name, account, nationalId, balance };
                        })
                        .filter(r => r.account || r.name || r.nationalId);

                    if (parsedRows.length === 0) {
                        alert('⚠️ لم يتم العثور على بيانات صالحة');
                        return;
                    }

                    const resolvedRows = resolveDuplicateAccounts(parsedRows, 'دينار');

                    let addedCount = 0;
                    let updatedCount = 0;
                    let conflictCount = 0;

                    const existingByLast6 = new Map();
                    balancesData.forEach((row, idx) => {
                        const key = getLast6Digits(row.account);
                        if (key) {
                            if (!existingByLast6.has(key)) existingByLast6.set(key, []);
                            existingByLast6.get(key).push(idx);
                        }
                    });

                    resolvedRows.forEach(r => {
                        const key = getLast6Digits(r.account);
                        if (!key) return;

                        const matchingIndexes = existingByLast6.get(key) || [];

                        if (matchingIndexes.length >= 1) {
                            const idx = matchingIndexes[0];
                            balancesData[idx].dinarBalance = r.balance;

                            if (!balancesData[idx].name && r.name) {
                                balancesData[idx].name = r.name;
                            }
                            if (!balancesData[idx].nationalId && r.nationalId) {
                                balancesData[idx].nationalId = r.nationalId;
                            }

                            if (r.note) {
                                const existingNote = balancesData[idx].comment || '';
                                if (!existingNote.includes(r.note)) {
                                    balancesData[idx].comment = existingNote
                                        ? existingNote + '\n' + r.note
                                        : r.note;
                                }
                                conflictCount++;
                            }

                            updatedCount++;
                        } else {
                            const newRow = {
                                name: r.name,
                                account: r.account,
                                nationalId: r.nationalId,
                                dinarBalance: r.balance,
                                dollarBalance: 0,
                                comment: r.note || '',
                                _id: generateRowId()
                            };

                            balancesData.push(newRow);
                            existingByLast6.set(key, [balancesData.length - 1]);

                            if (r.note) conflictCount++;
                            addedCount++;
                        }
                    });

                    rebuildBalancesRowIndexMap();
                    saveBalancesData();

                    balancesPage = 1;
                    updateBalancesStats();
                    renderBalancesTable();
                    updateBalancesFloatingScrollbar();

                    let msg = `✅ تم استيراد شيت الدينار\n\n🆕 صفوف جديدة: ${addedCount}\n♻️ صفوف محدّثة: ${updatedCount}`;
                    if (conflictCount > 0) {
                        msg += `\n⚠️ حالات تعارض (حسابات متشابهة): ${conflictCount} — راجع عمود الملاحظة`;
                    }
                    alert(msg);

                } catch (error) {
                    console.error(error);
                    alert('❌ حدث خطأ أثناء قراءة ملف الدينار\nتأكد من صيغة الأعمدة:\nالاسم | رقم الحساب | الرقم الوطني | رصيد الدينار');
                }

                dinarExcelInput.value = '';
            };

            reader.readAsArrayBuffer(file);
        });
    }

    // ============ ✅ استيراد شيت الدولار ==========
    const importDollarBtn = document.getElementById('importDollarBtn');
    const dollarExcelInput = document.getElementById('dollarExcelInput');

    if (importDollarBtn) {
        importDollarBtn.addEventListener('click', () => {
            dollarExcelInput.click();
        });
    }

    if (dollarExcelInput) {
        dollarExcelInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();

            reader.onload = (event) => {
                try {
                    const data = new Uint8Array(event.target.result);

                    const workbook = XLSX.read(data, {
                        type: 'array',
                        cellDates: true,
                        cellNF: false,
                        cellText: false,
                        raw: true
                    });

                    const sheet = workbook.Sheets[workbook.SheetNames[0]];

                    const rows = XLSX.utils.sheet_to_json(sheet, {
                        header: 1,
                        raw: true,
                        defval: '',
                        blankrows: false
                    });

                    if (rows.length < 2) {
                        alert('⚠️ الملف فاضي أو مش فيه بيانات');
                        return;
                    }

                    const dataRows = rows.slice(1);

                    const parsedRows = dataRows
                        .filter(row => row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== ''))
                        .map(row => {
                            const name = excelCellToString(row[0]);
                            const account = excelCellToString(row[1]);
                            const nationalId = excelCellToString(row[2]);
                            const balance = excelCellToNumber(row[3]);
                            return { name, account, nationalId, balance };
                        })
                        .filter(r => r.account || r.name || r.nationalId);

                    if (parsedRows.length === 0) {
                        alert('⚠️ لم يتم العثور على بيانات صالحة');
                        return;
                    }

                    const resolvedRows = resolveDuplicateAccounts(parsedRows, 'دولار');

                    let addedCount = 0;
                    let updatedCount = 0;
                    let conflictCount = 0;

                    const existingByLast6 = new Map();
                    balancesData.forEach((row, idx) => {
                        const key = getLast6Digits(row.account);
                        if (key) {
                            if (!existingByLast6.has(key)) existingByLast6.set(key, []);
                            existingByLast6.get(key).push(idx);
                        }
                    });

                    resolvedRows.forEach(r => {
                        const key = getLast6Digits(r.account);
                        if (!key) return;

                        const matchingIndexes = existingByLast6.get(key) || [];

                        if (matchingIndexes.length >= 1) {
                            const idx = matchingIndexes[0];
                            balancesData[idx].dollarBalance = r.balance;

                            if (!balancesData[idx].name && r.name) {
                                balancesData[idx].name = r.name;
                            }

                            if (r.note) {
                                const existingNote = balancesData[idx].comment || '';
                                if (!existingNote.includes(r.note)) {
                                    balancesData[idx].comment = existingNote
                                        ? existingNote + '\n' + r.note
                                        : r.note;
                                }
                                conflictCount++;
                            }

                            updatedCount++;
                        } else {
                            const newRow = {
                                name: r.name,
                                account: r.account,
                                nationalId: r.nationalId,
                                dinarBalance: 0,
                                dollarBalance: r.balance,
                                comment: r.note || '',
                                _id: generateRowId()
                            };

                            balancesData.push(newRow);
                            existingByLast6.set(key, [balancesData.length - 1]);

                            if (r.note) conflictCount++;
                            addedCount++;
                        }
                    });

                    rebuildBalancesRowIndexMap();
                    saveBalancesData();

                    balancesPage = 1;
                    updateBalancesStats();
                    renderBalancesTable();
                    updateBalancesFloatingScrollbar();

                    let msg = `✅ تم استيراد شيت الدولار\n\n🆕 صفوف جديدة: ${addedCount}\n♻️ صفوف محدّثة: ${updatedCount}`;
                    if (conflictCount > 0) {
                        msg += `\n⚠️ حالات تعارض (حسابات متشابهة): ${conflictCount} — راجع عمود الملاحظة`;
                    }
                    alert(msg);

                } catch (error) {
                    console.error(error);
                    alert('❌ حدث خطأ أثناء قراءة ملف الدولار\nتأكد من صيغة الأعمدة:\nالاسم | رقم الحساب | الرقم الوطني | رصيد الدولار');
                }

                dollarExcelInput.value = '';
            };

            reader.readAsArrayBuffer(file);
        });
    }

    const addBalanceBtn = document.getElementById('addBalanceBtn');
    if (addBalanceBtn) {
        addBalanceBtn.addEventListener('click', () => {
            const name = prompt('👤 اسم العميل:');
            if (!name || !name.trim()) return;

            const account = prompt('🔢 رقم الحساب:') || '';
            const nationalId = prompt('🆔 الرقم الوطني:') || '';
            const dinar = parseFloat(prompt('💵 رصيد الدينار (د.ل):', '0')) || 0;
            const dollar = parseFloat(prompt('💵 رصيد الدولار ($):', '0')) || 0;

            const newRow = {
                name: name.trim(),
                account: account.trim(),
                nationalId: nationalId.trim(),
                dinarBalance: dinar,
                dollarBalance: dollar,
                comment: '',
                _id: generateRowId()
            };

            balancesData.push(newRow);
            rebuildBalancesRowIndexMap();
            saveBalancesData();

            updateBalancesStats();
            renderBalancesTable();

            alert('✅ تم إضافة السجل بنجاح');
        });
    }
});

// ==================================================================
// ================== مودال الملفات المرفقة =========================
// ==================================================================
const filesModal = document.getElementById('filesModal');
const filesModalClose = document.getElementById('filesModalClose');
const filesModalDone = document.getElementById('filesModalDone');
const filesAddBtn = document.getElementById('filesAddBtn');
const filesInput = document.getElementById('filesInput');
const filesList = document.getElementById('filesList');

function openFilesModal(rowId) {
    const row = transactionsData.find(r => r._id === rowId);
    if (!row) {
        alert('⚠️ مش لاقي الصف المطلوب');
        return;
    }

    currentFilesRowId = rowId;

    const personName = document.getElementById('filesModalPersonName');
    if (personName) personName.textContent = row.name || '(بدون اسم)';

    renderFilesList();
    filesModal.classList.add('show');
}

function closeFilesModal() {
    if (filesModal) filesModal.classList.remove('show');
    currentFilesRowId = null;
}

function renderFilesList() {
    if (!filesList) return;

    const row = transactionsData.find(r => r._id === currentFilesRowId);
    if (!row) return;

    const files = row.files || [];

    if (files.length === 0) {
        filesList.innerHTML = '';
        return;
    }

    filesList.innerHTML = files.map((file, i) => `
        <div class="file-item" data-file-index="${i}">
            <div class="file-icon">${getFileIcon(file.name, file.type)}</div>
            <div class="file-info">
                <div class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
                <div class="file-meta">${formatFileSize(file.size)} • ${file.uploadedAt || ''}</div>
            </div>
            <div class="file-actions">
                <button class="file-btn open" data-action="open-file" data-index="${i}" title="فتح / تحميل">👁️</button>
                <button class="file-btn delete" data-action="delete-file" data-index="${i}" title="حذف">🗑️</button>
            </div>
        </div>
    `).join('');
}

async function addFilesToCurrentRow(fileList) {
    if (!currentFilesRowId) return;

    const row = transactionsData.find(r => r._id === currentFilesRowId);
    if (!row) return;

    if (!row.files) row.files = [];

    const filesArray = Array.from(fileList);

    const oversized = filesArray.filter(f => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
        const names = oversized.map(f => f.name).join('\n• ');
        alert(`⚠️ الملفات دي حجمها أكبر من ${formatFileSize(MAX_FILE_SIZE)}:\n\n• ${names}\n\nهيتم تجاهلها.`);
    }

    const validFiles = filesArray.filter(f => f.size <= MAX_FILE_SIZE);
    if (validFiles.length === 0) return;

    for (const file of validFiles) {
        try {
            const base64 = await fileToBase64(file);
            row.files.push({
                name: file.name,
                type: file.type || 'application/octet-stream',
                size: file.size,
                data: base64,
                uploadedAt: new Date().toLocaleString('ar-EG')
            });
        } catch (e) {
            console.error('خطأ في قراءة الملف:', file.name, e);
        }
    }

    saveData();
    renderFilesList();
    renderAllTables();

    alert(`✅ تم إرفاق ${validFiles.length} ملف`);
}

function openFileFromRow(fileIndex) {
    const row = transactionsData.find(r => r._id === currentFilesRowId);
    if (!row || !row.files || !row.files[fileIndex]) return;

    const file = row.files[fileIndex];

    try {
        const link = document.createElement('a');
        link.href = file.data;
        link.download = file.name;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) {
        console.error(e);
        alert('❌ فشل فتح الملف');
    }
}

function deleteFileFromRow(fileIndex) {
    const row = transactionsData.find(r => r._id === currentFilesRowId);
    if (!row || !row.files || !row.files[fileIndex]) return;

    const file = row.files[fileIndex];
    if (!confirm(`هل تريد حذف الملف "${file.name}"؟`)) return;

    row.files.splice(fileIndex, 1);
    saveData();
    renderFilesList();
    renderAllTables();

    alert('✅ تم حذف الملف');
}

if (filesModalClose) filesModalClose.addEventListener('click', closeFilesModal);
if (filesModalDone) filesModalDone.addEventListener('click', closeFilesModal);

if (filesModal) {
    filesModal.addEventListener('click', (e) => {
        if (e.target === filesModal) closeFilesModal();
    });
}

if (filesAddBtn) {
    filesAddBtn.addEventListener('click', () => {
        filesInput.click();
    });
}

if (filesInput) {
    filesInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files.length > 0) {
            await addFilesToCurrentRow(e.target.files);
        }
        filesInput.value = '';
    });
}

if (filesList) {
    filesList.addEventListener('click', (e) => {
        const btn = e.target.closest('.file-btn');
        if (!btn) return;

        const action = btn.dataset.action;
        const index = parseInt(btn.dataset.index);

        if (action === 'open-file') openFileFromRow(index);
        if (action === 'delete-file') deleteFileFromRow(index);
    });
}

document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="files"]');
    if (!btn) return;
    const rowId = btn.dataset.rowId;
    if (rowId) openFilesModal(rowId);
});

// ==================================================================
// ================== السلايدر الأفقي العائم ========================
// ==================================================================
function initFloatingScrollbar() {
    const tableScroll = document.querySelector('#dashboardView .table-scroll');
    if (!tableScroll) return;

    const existing = document.getElementById('floatingScrollbar');
    if (existing) existing.remove();

    const floating = document.createElement('div');
    floating.id = 'floatingScrollbar';
    floating.className = 'floating-scrollbar';
    floating.innerHTML = '<div class="floating-scrollbar-inner"></div>';

    tableScroll.parentNode.insertBefore(floating, tableScroll.nextSibling);

    const inner = floating.querySelector('.floating-scrollbar-inner');

    function updateInnerWidth() {
        const totalWidth = tableScroll.scrollWidth;
        inner.style.width = totalWidth + 'px';
        if (tableScroll.scrollWidth <= tableScroll.clientWidth) floating.style.display = 'none';
        else floating.style.display = 'block';
    }

    floating.addEventListener('scroll', () => {
        tableScroll.scrollLeft = floating.scrollLeft;
    });
    tableScroll.addEventListener('scroll', () => {
        floating.scrollLeft = tableScroll.scrollLeft;
    });

    updateInnerWidth();
    window.addEventListener('resize', updateInnerWidth);
}

function updateFloatingScrollbar() {
    const tableScroll = document.querySelector('#dashboardView .table-scroll');
    if (!tableScroll) return;
    const floating = document.getElementById('floatingScrollbar');
    if (!floating) return;
    const inner = floating.querySelector('.floating-scrollbar-inner');
    if (!inner) return;

    inner.style.width = tableScroll.scrollWidth + 'px';

    if (tableScroll.scrollWidth <= tableScroll.clientWidth) floating.style.display = 'none';
    else floating.style.display = 'block';

    floating.scrollLeft = tableScroll.scrollLeft;
}

function initProblemsFloatingScrollbar() {
    const tableScroll = document.querySelector('#problemsView .table-scroll');
    if (!tableScroll) return;

    const existing = document.getElementById('problemsFloatingScrollbar');
    if (existing) existing.remove();

    const floating = document.createElement('div');
    floating.id = 'problemsFloatingScrollbar';
    floating.className = 'floating-scrollbar';
    floating.innerHTML = '<div class="floating-scrollbar-inner"></div>';

    tableScroll.parentNode.insertBefore(floating, tableScroll.nextSibling);

    const inner = floating.querySelector('.floating-scrollbar-inner');

    function updateInnerWidth() {
        const totalWidth = tableScroll.scrollWidth;
        inner.style.width = totalWidth + 'px';
        if (tableScroll.scrollWidth <= tableScroll.clientWidth) floating.style.display = 'none';
        else floating.style.display = 'block';
    }

    floating.addEventListener('scroll', () => {
        tableScroll.scrollLeft = floating.scrollLeft;
    });
    tableScroll.addEventListener('scroll', () => {
        floating.scrollLeft = tableScroll.scrollLeft;
    });

    updateInnerWidth();
    window.addEventListener('resize', updateInnerWidth);
}

function updateProblemsFloatingScrollbar() {
    const tableScroll = document.querySelector('#problemsView .table-scroll');
    if (!tableScroll) return;
    const floating = document.getElementById('problemsFloatingScrollbar');
    if (!floating) return;
    const inner = floating.querySelector('.floating-scrollbar-inner');
    if (!inner) return;

    inner.style.width = tableScroll.scrollWidth + 'px';

    if (tableScroll.scrollWidth <= tableScroll.clientWidth) floating.style.display = 'none';
    else floating.style.display = 'block';

    floating.scrollLeft = tableScroll.scrollLeft;
}

function initCardsFloatingScrollbar() {
    const tableScroll = document.querySelector('#cardsView .table-scroll');
    if (!tableScroll) return;

    const existing = document.getElementById('cardsFloatingScrollbar');
    if (existing) existing.remove();

    const floating = document.createElement('div');
    floating.id = 'cardsFloatingScrollbar';
    floating.className = 'floating-scrollbar';
    floating.innerHTML = '<div class="floating-scrollbar-inner"></div>';

    tableScroll.parentNode.insertBefore(floating, tableScroll.nextSibling);

    const inner = floating.querySelector('.floating-scrollbar-inner');

    function updateInnerWidth() {
        const totalWidth = tableScroll.scrollWidth;
        inner.style.width = totalWidth + 'px';
        if (tableScroll.scrollWidth <= tableScroll.clientWidth) floating.style.display = 'none';
        else floating.style.display = 'block';
    }

    floating.addEventListener('scroll', () => {
        tableScroll.scrollLeft = floating.scrollLeft;
    });
    tableScroll.addEventListener('scroll', () => {
        floating.scrollLeft = tableScroll.scrollLeft;
    });

    updateInnerWidth();
    window.addEventListener('resize', updateInnerWidth);
}

function updateCardsFloatingScrollbar() {
    const tableScroll = document.querySelector('#cardsView .table-scroll');
    if (!tableScroll) return;
    const floating = document.getElementById('cardsFloatingScrollbar');
    if (!floating) return;
    const inner = floating.querySelector('.floating-scrollbar-inner');
    if (!inner) return;

    inner.style.width = tableScroll.scrollWidth + 'px';

    if (tableScroll.scrollWidth <= tableScroll.clientWidth) floating.style.display = 'none';
    else floating.style.display = 'block';

    floating.scrollLeft = tableScroll.scrollLeft;
}

function initBalancesFloatingScrollbar() {
    const tableScroll = document.querySelector('#balancesView .table-scroll');
    if (!tableScroll) return;

    const existing = document.getElementById('balancesFloatingScrollbar');
    if (existing) existing.remove();

    const floating = document.createElement('div');
    floating.id = 'balancesFloatingScrollbar';
    floating.className = 'floating-scrollbar';
    floating.innerHTML = '<div class="floating-scrollbar-inner"></div>';

    tableScroll.parentNode.insertBefore(floating, tableScroll.nextSibling);

    const inner = floating.querySelector('.floating-scrollbar-inner');

    function updateInnerWidth() {
        const totalWidth = tableScroll.scrollWidth;
        inner.style.width = totalWidth + 'px';
        if (tableScroll.scrollWidth <= tableScroll.clientWidth) floating.style.display = 'none';
        else floating.style.display = 'block';
    }

    floating.addEventListener('scroll', () => {
        tableScroll.scrollLeft = floating.scrollLeft;
    });
    tableScroll.addEventListener('scroll', () => {
        floating.scrollLeft = tableScroll.scrollLeft;
    });

    updateInnerWidth();
    window.addEventListener('resize', updateInnerWidth);
}

function updateBalancesFloatingScrollbar() {
    const tableScroll = document.querySelector('#balancesView .table-scroll');
    if (!tableScroll) return;
    const floating = document.getElementById('balancesFloatingScrollbar');
    if (!floating) return;
    const inner = floating.querySelector('.floating-scrollbar-inner');
    if (!inner) return;

    inner.style.width = tableScroll.scrollWidth + 'px';

    if (tableScroll.scrollWidth <= tableScroll.clientWidth) floating.style.display = 'none';
    else floating.style.display = 'block';

    floating.scrollLeft = tableScroll.scrollLeft;
}

function updateAllFloatingScrollbars() {
    updateFloatingScrollbar();
    updateProblemsFloatingScrollbar();
    updateCardsFloatingScrollbar();
    updateBalancesFloatingScrollbar();
}

// ==================================================================
// ================== اختصارات لوحة المفاتيح =======================
// ==================================================================
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (currentPage === 'problems') {
            const el = document.getElementById('problemsSearchInput');
            if (el) el.focus();
        } else if (currentPage === 'cards') {
            const el = document.getElementById('cardsSearchInput');
            if (el) el.focus();
        } else if (currentPage === 'balances') {
            const el = document.getElementById('balancesSearchInput');
            if (el) el.focus();
        } else {
            searchInput.focus();
        }
    }
    if (e.key === 'Escape') {
        filterDropdown.classList.remove('show');
        if (compareModal.classList.contains('show')) closeCompareModal();

        const unmatched = document.getElementById('unmatchedModal');
        if (unmatched) unmatched.remove();

        if (filesModal && filesModal.classList.contains('show')) closeFilesModal();

        const transactionModalEl = document.getElementById('transactionModal');
        if (transactionModalEl && transactionModalEl.classList.contains('show')) {
            transactionModalEl.classList.remove('show');
        }

        hideTooltip();
    }
});

// ==================================================================
// ================== نظام Tooltip للتعليقات ========================
// ==================================================================
let tooltipTimer = null;

function showTooltip(target, text) {
    clearTimeout(tooltipTimer);

    tooltipTimer = setTimeout(() => {
        document.querySelectorAll('.comment-tooltip').forEach(t => t.remove());

        const tip = document.createElement('div');
        tip.className = 'comment-tooltip show';
        tip.textContent = text;
        document.body.appendChild(tip);

        const rect = target.getBoundingClientRect();
        const tipRect = tip.getBoundingClientRect();

        let top = rect.top - tipRect.height - 12;
        let left = rect.left + (rect.width / 2) - (tipRect.width / 2);

        if (top < 10) {
            top = rect.bottom + 12;
            tip.classList.add('above');
        }

        if (left < 10) left = 10;
        if (left + tipRect.width > window.innerWidth - 10) {
            left = window.innerWidth - tipRect.width - 10;
        }

        if (top + tipRect.height > window.innerHeight - 10) {
            top = window.innerHeight - tipRect.height - 10;
        }

        tip.style.top = top + 'px';
        tip.style.left = left + 'px';

        const arrowPos = Math.max(15, Math.min(tipRect.width - 30, rect.left + rect.width / 2 - left));
        tip.style.setProperty('--arrow-pos', arrowPos + 'px');
    }, 200);
}

function hideTooltip() {
    clearTimeout(tooltipTimer);
    document.querySelectorAll('.comment-tooltip').forEach(t => t.remove());
}

document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[data-comment]');
    if (!target) return;
    const comment = target.dataset.comment;
    if (!comment || !comment.trim()) return;
    showTooltip(target, comment);
});

document.addEventListener('mouseout', (e) => {
    const target = e.target.closest('[data-comment]');
    if (!target) return;
    hideTooltip();
});

let touchTimer = null;
document.addEventListener('touchstart', (e) => {
    const target = e.target.closest('[data-comment]');
    if (!target) return;
    const comment = target.dataset.comment;
    if (!comment || !comment.trim()) return;
    touchTimer = setTimeout(() => {
        showTooltip(target, comment);
    }, 500);
}, { passive: true });

document.addEventListener('touchend', () => {
    clearTimeout(touchTimer);
    setTimeout(hideTooltip, 2000);
});

document.addEventListener('touchmove', () => {
    clearTimeout(touchTimer);
    hideTooltip();
}, { passive: true });

window.addEventListener('scroll', hideTooltip, true);
document.addEventListener('click', hideTooltip);

// ==================================================================
// ================== تصدير Excel حسب الصفحة الحالية ================
// ==================================================================
const exportBtn = document.getElementById('exportBtn');

const EXPORT_COLUMNS = {
    dashboard: [
        { key: 'name',         label: 'الاسم' },
        { key: 'account',      label: 'رقم الحساب' },
        { key: 'card',         label: 'رقم البطاقة' },
        { key: 'nationalId',   label: 'الرقم الوطني' },
        { key: 'phone',        label: 'رقم الهاتف' },
        { key: 'supplier',     label: 'اسم المورد' },
        { key: 'depositDate',  label: 'تاريخ الإيداع' },
        { key: 'depositValue', label: 'قيمة الإيداع' },
        { key: 'note',         label: 'ملاحظة' },
        { key: 'withdrawn',    label: 'تم السحب' },
        { key: 'comment',      label: 'التعليق' }
    ],
    problems: [
        { key: 'name',         label: 'الاسم' },
        { key: 'account',      label: 'رقم الحساب' },
        { key: 'card',         label: 'رقم البطاقة' },
        { key: 'nationalId',   label: 'الرقم الوطني' },
        { key: 'phone',        label: 'رقم الهاتف' },
        { key: 'supplier',     label: 'اسم المورد' },
        { key: 'depositDate',  label: 'تاريخ الإيداع' },
        { key: 'depositValue', label: 'قيمة الإيداع' },
        { key: 'note',         label: 'ملاحظة' },
        { key: 'withdrawn',    label: 'تم السحب' },
        { key: 'comment',      label: 'التعليق' }
    ],
    cards: [
        { key: 'name',            label: 'الاسم' },
        { key: 'account',         label: 'رقم الحساب' },
        { key: 'nationalId',      label: 'الرقم الوطني' },
        { key: 'phone',           label: 'رقم الهاتف' },
        { key: 'supplier',        label: 'اسم المورد' },
        { key: 'cardIssueReason', label: 'سبب الإصدار' },
        { key: 'newCardNumber',   label: 'رقم البطاقة التي صدرت' },
        { key: 'sendDate',        label: 'تاريخ الإرسال' },
        { key: 'receiveDate',     label: 'تاريخ الاستلام' },
        { key: 'cardIssued',      label: 'تم الإصدار' },
        { key: 'comment',         label: 'التعليق' }
    ],
    balances: [
        { key: 'name',          label: 'الاسم' },
        { key: 'account',       label: 'رقم الحساب' },
        { key: 'nationalId',    label: 'الرقم الوطني' },
        { key: 'dinarBalance',  label: 'رصيد الدينار' },
        { key: 'dollarBalance', label: 'رصيد الدولار' },
        { key: 'comment',       label: 'ملاحظة' }
    ]
};

const EXPORT_FILENAMES = {
    dashboard: 'المعاملات',
    problems:  'المشاكل',
    cards:     'البطاقات',
    balances:  'أرصدة_الدينار_والدولار'
};

const EXPORT_SHEET_NAMES = {
    dashboard: 'سجل المعاملات',
    problems:  'سجل المشاكل',
    cards:     'سجل إصدار البطاقات',
    balances:  'سجل الأرصدة'
};

function getCurrentPageData() {
    if (currentPage === 'problems') return getProblemsData();
    if (currentPage === 'cards') return getCardsData();
    if (currentPage === 'balances') return getBalancesData();
    return getFilteredData();
}

function exportCurrentPageToExcel() {
    if (typeof XLSX === 'undefined') {
        alert('❌ مكتبة Excel مش محمّلة — تأكد من الاتصال بالإنترنت');
        return;
    }

    const data = getCurrentPageData();

    if (!data || data.length === 0) {
        alert('⚠️ مفيش بيانات في الصفحة الحالية لتصديرها');
        return;
    }

    const columns = EXPORT_COLUMNS[currentPage] || EXPORT_COLUMNS.dashboard;
    const sheetName = EXPORT_SHEET_NAMES[currentPage] || 'البيانات';
    const baseFileName = EXPORT_FILENAMES[currentPage] || 'export';

    const headers = columns.map(c => c.label);

    const rows = data.map(row => {
        return columns.map(col => {
            let value = row[col.key];

            if (col.key === 'account') value = normalizeAccount(value);
            else if (col.key === 'phone') value = normalizePhone(value);
            else if (col.key === 'nationalId') value = normalizeNationalId(value);
            else if (col.key === 'card' || col.key === 'newCardNumber') value = normalizeCard(value);
            else if (col.key === 'depositValue') value = Number(value) || 0;
            else if (col.key === 'dinarBalance' || col.key === 'dollarBalance') value = Number(value) || 0;
            else if (col.key === 'cardIssueReason') value = value || row.note || '';
            else if (col.key === 'cardIssued') value = value || 'لا';

            if (value === undefined || value === null) value = '';
            return value;
        });
    });

    const aoa = [headers, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(aoa);

    worksheet['!cols'] = columns.map(col => {
        if (col.key === 'note' || col.key === 'comment' || col.key === 'cardIssueReason') return { wch: 30 };
        if (col.key === 'name' || col.key === 'supplier') return { wch: 20 };
        if (col.key === 'card' || col.key === 'newCardNumber' || col.key === 'nationalId') return { wch: 22 };
        return { wch: 16 };
    });

    worksheet['!dir'] = 'rtl';

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const today = new Date().toISOString().split('T')[0];
    const fileName = `${baseFileName}_${today}.xlsx`;

    XLSX.writeFile(workbook, fileName);
}

if (exportBtn) {
    exportBtn.addEventListener('click', exportCurrentPageToExcel);
}

// ==================================================================
// ================== نظام تبديل المظهر (Dark/Light) ================
// ==================================================================
const THEME_STORAGE_KEY = 'transactions_theme_preference';

function initTheme() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const themeToggle = document.getElementById('themeToggle');
    const labelDark = document.getElementById('themeLabelDark');
    const labelLight = document.getElementById('themeLabelLight');

    if (!themeToggle) return;

    const isLight = savedTheme === 'light';

    if (isLight) {
        document.body.classList.add('light-theme');
        themeToggle.checked = true;
        if (labelDark) labelDark.classList.remove('active');
        if (labelLight) labelLight.classList.add('active');
    } else {
        document.body.classList.remove('light-theme');
        themeToggle.checked = false;
        if (labelDark) labelDark.classList.add('active');
        if (labelLight) labelLight.classList.remove('active');
    }

    themeToggle.addEventListener('change', () => {
        const labelDark = document.getElementById('themeLabelDark');
        const labelLight = document.getElementById('themeLabelLight');

        if (themeToggle.checked) {
            document.body.classList.add('light-theme');
            localStorage.setItem(THEME_STORAGE_KEY, 'light');
            if (labelDark) labelDark.classList.remove('active');
            if (labelLight) labelLight.classList.add('active');
        } else {
            document.body.classList.remove('light-theme');
            localStorage.setItem(THEME_STORAGE_KEY, 'dark');
            if (labelDark) labelDark.classList.add('active');
            if (labelLight) labelLight.classList.remove('active');
        }
    });
}

initTheme();

// ==================================================================
// ================== إضافة معاملة جديدة (لوحة التحكم) ==============
// ==================================================================
const addTransactionBtn = document.getElementById('addTransactionBtn');
const transactionModal = document.getElementById('transactionModal');
const transactionModalClose = document.getElementById('transactionModalClose');
const transactionModalCancel = document.getElementById('transactionModalCancel');
const transactionModalSave = document.getElementById('transactionModalSave');

if (addTransactionBtn) {
    addTransactionBtn.addEventListener('click', () => {
        document.getElementById('txName').value = '';
        document.getElementById('txAccount').value = '';
        document.getElementById('txCard').value = '';
        document.getElementById('txNationalId').value = '';
        document.getElementById('txPhone').value = '';
        document.getElementById('txSupplier').value = '';
        document.getElementById('txDepositDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('txDepositValue').value = '';
        document.getElementById('txNote').value = '';
        document.getElementById('txWithdrawn').value = 'لا';
        document.getElementById('txComment').value = '';

        transactionModal.classList.add('show');
        setTimeout(() => document.getElementById('txName').focus(), 100);
    });
}

function closeTransactionModal() {
    if (transactionModal) transactionModal.classList.remove('show');
}

if (transactionModalClose) transactionModalClose.addEventListener('click', closeTransactionModal);
if (transactionModalCancel) transactionModalCancel.addEventListener('click', closeTransactionModal);

if (transactionModal) {
    transactionModal.addEventListener('click', (e) => {
        if (e.target === transactionModal) closeTransactionModal();
    });
}

if (transactionModalSave) {
    transactionModalSave.addEventListener('click', () => {
        const name = document.getElementById('txName').value.trim();

        if (!name) {
            alert('⚠️ من فضلك أدخل اسم العميل');
            document.getElementById('txName').focus();
            return;
        }

        let account = document.getElementById('txAccount').value.trim();
        let phone = document.getElementById('txPhone').value.trim();
        const card = document.getElementById('txCard').value.trim();
        const nationalId = document.getElementById('txNationalId').value.trim();
        const supplier = document.getElementById('txSupplier').value.trim();
        const depositDate = document.getElementById('txDepositDate').value;
        const depositValue = parseFloat(document.getElementById('txDepositValue').value) || 0;
        const note = document.getElementById('txNote').value.trim();
        const withdrawn = document.getElementById('txWithdrawn').value;
        const comment = document.getElementById('txComment').value.trim();

        if (account && !account.startsWith('0')) account = '0' + account;
        if (phone && !phone.startsWith('0')) phone = '0' + phone;

        const newRow = {
            name: name,
            account: account,
            card: card,
            nationalId: nationalId,
            phone: phone,
            supplier: supplier,
            depositDate: depositDate,
            depositValue: depositValue,
            note: note,
            withdrawn: withdrawn,
            comment: comment,
            cardIssueReason: note || '',
            newCardNumber: '',
            sendDate: '',
            receiveDate: '',
            cardIssued: 'لا',
            _id: generateRowId(),
            files: []
        };

        transactionsData.push(newRow);
        rebuildRowIndexMap();
        saveData();

        updateStats();
        updateProblemsStats();
        updateCardsStats();
        renderAllTables();

        closeTransactionModal();
        alert(`✅ تم إضافة معاملة "${name}" بنجاح`);
    });
}

// ==================================================================
// ================== تشغيل أولي ===================================
// ==================================================================
rebuildRowIndexMap();
rebuildBalancesRowIndexMap();

updateStats();
renderTable();
updateProblemsStats();
renderProblemsTable();
updateCardsStats();
renderCardsTable();
updateBalancesStats();
renderBalancesTable();

window.addEventListener('load', () => {
    initFloatingScrollbar();
    initProblemsFloatingScrollbar();
    initCardsFloatingScrollbar();
    initBalancesFloatingScrollbar();
});