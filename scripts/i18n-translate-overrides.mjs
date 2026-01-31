import ts from 'typescript'
import fs from 'node:fs'
import path from 'node:path'

function loadLocale(file) {
  const src = fs.readFileSync(file, 'utf8')
  const out = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText

  const wrapped = out.replace(/export\s+default\s+/, 'return ')
  // eslint-disable-next-line no-new-func
  return new Function(wrapped)()
}

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function getPath(obj, keyPath) {
  const parts = keyPath.split('.')
  let cur = obj
  for (const part of parts) {
    if (!isPlainObject(cur) || !(part in cur)) return undefined
    cur = cur[part]
  }
  return cur
}

function setPath(obj, keyPath, value) {
  const parts = keyPath.split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    const next = cur[part]
    if (!isPlainObject(next)) cur[part] = {}
    cur = cur[part]
  }
  cur[parts[parts.length - 1]] = value
}

function escapeString(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\n|\r/g, '\\n')
    .replace(/'/g, "\\'")
}

function isValidIdentifier(key) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
}

function formatKey(key) {
  if (/^\d+$/.test(key)) return key
  if (isValidIdentifier(key)) return key
  return `'${escapeString(key)}'`
}

function formatValue(value, indentLevel) {
  if (isPlainObject(value)) return formatObject(value, indentLevel)
  if (Array.isArray(value)) {
    const items = value.map((v) => formatValue(v, indentLevel + 1))
    return `[${items.join(', ')}]`
  }
  if (typeof value === 'string') return `'${escapeString(value)}'`
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value === null || value === undefined) return 'null'
  return `'${escapeString(String(value))}'`
}

function formatObject(obj, indentLevel) {
  const indent = '  '.repeat(indentLevel)
  const childIndent = '  '.repeat(indentLevel + 1)

  const entries = Object.entries(obj)
  if (entries.length === 0) return '{}'

  const lines = ['{']
  for (const [k, v] of entries) {
    lines.push(`${childIndent}${formatKey(k)}: ${formatValue(v, indentLevel + 1)},`)
  }
  lines.push(`${indent}}`)
  return lines.join('\n')
}

// Per-locale overrides for keys that were previously filled with en-US fallback.
// Only applied when the current locale value is missing or equals en-US.
const overridesByLocaleFile = {
  'bn.ts': {
    'login.too_many_login_attempts': 'লগইন প্রচেষ্টা খুব বেশি। অনুগ্রহ করে ১ মিনিট পরে আবার চেষ্টা করুন।',
    start_time: 'শুরুর সময়',
    apply: 'প্রয়োগ করুন',
    search_filter_by_duration: 'কলের সময়কাল দিয়ে ফিল্টার',
    search_filter_by_start_time: 'শুরুর সময় দিয়ে ফিল্টার',
    search_calendar_select_date: 'ক্যালেন্ডার থেকে একটি তারিখ নির্বাচন করুন',
    in_trash: 'ট্র্যাশে',
    not_in_trash: 'ট্র্যাশে নয়',
    settings_saved: 'সেটিংস সংরক্ষণ করা হয়েছে',
    feed: 'ফিড',
  },
  'de.ts': {
    'login.too_many_login_attempts': 'Zu viele Anmeldeversuche. Bitte in 1 Minute erneut versuchen.',
    start_time: 'Startzeit',
    apply: 'Übernehmen',
    search_filter_by_duration: 'Nach Anrufdauer filtern',
    search_filter_by_start_time: 'Nach Startzeit filtern',
    search_calendar_select_date: 'Datum im Kalender auswählen',
    in_trash: 'Im Papierkorb',
    not_in_trash: 'Nicht im Papierkorb',
    settings_saved: 'Einstellungen gespeichert',
    feed: 'Neuigkeiten',
  },
  'es.ts': {
    'login.too_many_login_attempts': 'Demasiados intentos de inicio de sesión. Inténtalo de nuevo en 1 minuto.',
    start_time: 'Hora de inicio',
    apply: 'Aplicar',
    search_filter_by_duration: 'Filtrar por duración de llamada',
    search_filter_by_start_time: 'Filtrar por hora de inicio',
    search_calendar_select_date: 'Selecciona una fecha del calendario',
    in_trash: 'En la papelera',
    not_in_trash: 'No está en la papelera',
    settings_saved: 'Ajustes guardados',
    feed: 'Fuente',
  },
  'fr.ts': {
    'login.too_many_login_attempts': 'Trop de tentatives de connexion. Réessayez dans 1 minute.',
    start_time: 'Heure de début',
    apply: 'Appliquer',
    search_filter_by_duration: 'Filtrer par durée d’appel',
    search_filter_by_start_time: 'Filtrer par heure de début',
    search_calendar_select_date: 'Sélectionnez une date dans le calendrier',
    in_trash: 'Dans la corbeille',
    not_in_trash: 'Hors de la corbeille',
    settings_saved: 'Paramètres enregistrés',
    feed: 'Flux',
  },
  'hi.ts': {
    'login.too_many_login_attempts': 'लॉगिन प्रयास बहुत अधिक हैं। कृपया 1 मिनट बाद फिर से कोशिश करें।',
    start_time: 'आरंभ समय',
    apply: 'लागू करें',
    search_filter_by_duration: 'कॉल अवधि के अनुसार फ़िल्टर करें',
    search_filter_by_start_time: 'आरंभ समय के अनुसार फ़िल्टर करें',
    search_calendar_select_date: 'कैलेंडर से एक तारीख चुनें',
    in_trash: 'ट्रैश में',
    not_in_trash: 'ट्रैश में नहीं',
    settings_saved: 'सेटिंग्स सहेजी गईं',
    feed: 'फ़ीड',
  },
  'it.ts': {
    'login.too_many_login_attempts': 'Troppi tentativi di accesso. Riprova tra 1 minuto.',
    start_time: 'Ora di inizio',
    apply: 'Applica',
    search_filter_by_duration: 'Filtra per durata chiamata',
    search_filter_by_start_time: 'Filtra per ora di inizio',
    search_calendar_select_date: 'Seleziona una data dal calendario',
    in_trash: 'Nel cestino',
    not_in_trash: 'Non nel cestino',
    settings_saved: 'Impostazioni salvate',
    feed: 'Canale',
  },
  'ja.ts': {
    'login.too_many_login_attempts': 'ログイン試行回数が多すぎます。1分後にもう一度お試しください。',
    start_time: '開始時刻',
    apply: '適用',
    search_filter_by_duration: '通話時間で絞り込む',
    search_filter_by_start_time: '開始時刻で絞り込む',
    search_calendar_select_date: 'カレンダーから日付を選択',
    in_trash: 'ゴミ箱内',
    not_in_trash: 'ゴミ箱外',
    settings_saved: '設定を保存しました',
    feed: 'フィード',
  },
  'ko.ts': {
    'login.too_many_login_attempts': '로그인 시도가 너무 많습니다. 1분 후 다시 시도해 주세요.',
    start_time: '시작 시간',
    apply: '적용',
    search_filter_by_duration: '통화 시간으로 필터',
    search_filter_by_start_time: '시작 시간으로 필터',
    search_calendar_select_date: '캘린더에서 날짜를 선택하세요',
    in_trash: '휴지통에 있음',
    not_in_trash: '휴지통에 없음',
    settings_saved: '설정이 저장되었습니다',
    feed: '피드',
  },
  'nl.ts': {
    'login.too_many_login_attempts': 'Te veel inlogpogingen. Probeer het over 1 minuut opnieuw.',
    start_time: 'Starttijd',
    apply: 'Toepassen',
    search_filter_by_duration: 'Filter op gespreksduur',
    search_filter_by_start_time: 'Filter op starttijd',
    search_calendar_select_date: 'Selecteer een datum in de kalender',
    in_trash: 'In prullenbak',
    not_in_trash: 'Niet in prullenbak',
    settings_saved: 'Instellingen opgeslagen',
    feed: 'Kanaal',
  },
  'pt.ts': {
    'login.too_many_login_attempts': 'Muitas tentativas de login. Tente novamente em 1 minuto.',
    start_time: 'Hora de início',
    apply: 'Aplicar',
    search_filter_by_duration: 'Filtrar por duração da chamada',
    search_filter_by_start_time: 'Filtrar por horário de início',
    search_calendar_select_date: 'Selecione uma data no calendário',
    in_trash: 'Na lixeira',
    not_in_trash: 'Fora da lixeira',
    settings_saved: 'Configurações salvas',
    feed: 'Fonte',
  },
  'ru.ts': {
    'login.too_many_login_attempts': 'Слишком много попыток входа. Повторите через 1 минуту.',
    start_time: 'Время начала',
    apply: 'Применить',
    search_filter_by_duration: 'Фильтр по длительности звонка',
    search_filter_by_start_time: 'Фильтр по времени начала',
    search_calendar_select_date: 'Выберите дату в календаре',
    in_trash: 'В корзине',
    not_in_trash: 'Не в корзине',
    settings_saved: 'Настройки сохранены',
    feed: 'Лента',
  },
  'ta.ts': {
    'login.too_many_login_attempts': 'உள்நுழைவு முயற்சிகள் அதிகமாக உள்ளன. 1 நிமிடம் கழித்து மீண்டும் முயற்சிக்கவும்.',
    start_time: 'தொடக்க நேரம்',
    apply: 'பயன்படுத்து',
    search_filter_by_duration: 'அழைப்பு நீளத்தின் மூலம் வடிகட்டு',
    search_filter_by_start_time: 'தொடக்க நேரத்தின் மூலம் வடிகட்டு',
    search_calendar_select_date: 'காலெண்டரில் இருந்து ஒரு தேதியைத் தேர்ந்தெடுக்கவும்',
    in_trash: 'குப்பையில்',
    not_in_trash: 'குப்பையில் இல்லை',
    settings_saved: 'அமைப்புகள் சேமிக்கப்பட்டன',
    feed: 'ஊட்டம்',
  },
  'tr.ts': {
    'login.too_many_login_attempts': 'Çok fazla giriş denemesi. Lütfen 1 dakika sonra tekrar deneyin.',
    start_time: 'Başlangıç zamanı',
    apply: 'Uygula',
    search_filter_by_duration: 'Arama süresine göre filtrele',
    search_filter_by_start_time: 'Başlangıç zamanına göre filtrele',
    search_calendar_select_date: 'Takvimden bir tarih seçin',
    in_trash: 'Çöp kutusunda',
    not_in_trash: 'Çöp kutusunda değil',
    settings_saved: 'Ayarlar kaydedildi',
    feed: 'Akış',
  },
  'vi.ts': {
    'login.too_many_login_attempts': 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 1 phút.',
    start_time: 'Thời gian bắt đầu',
    apply: 'Áp dụng',
    search_filter_by_duration: 'Lọc theo thời lượng cuộc gọi',
    search_filter_by_start_time: 'Lọc theo thời gian bắt đầu',
    search_calendar_select_date: 'Chọn một ngày trên lịch',
    in_trash: 'Trong thùng rác',
    not_in_trash: 'Không trong thùng rác',
    settings_saved: 'Đã lưu cài đặt',
    feed: 'Nguồn cấp',
  },
  'zh-CN.ts': {
    start_time: '开始时间',
    apply: '应用',
    search_filter_by_duration: '按通话时长筛选',
    search_filter_by_start_time: '按开始时间筛选',
    search_calendar_select_date: '从日历中选择日期',
    in_trash: '在回收站',
    not_in_trash: '不在回收站',
    settings_saved: '设置已保存',
    feed: '订阅源',
  },
  'zh-TW.ts': {
    start_time: '開始時間',
    apply: '套用',
    search_filter_by_duration: '按通話時長篩選',
    search_filter_by_start_time: '按開始時間篩選',
    search_calendar_select_date: '從日曆中選擇日期',
    in_trash: '在回收筒',
    not_in_trash: '不在回收筒',
    settings_saved: '設定已儲存',
    feed: '訂閱源',
  },
}

const localesDir = path.resolve('src/locales')
const baseFile = path.join(localesDir, 'en-US.ts')
const baseObj = loadLocale(baseFile)

const files = fs.readdirSync(localesDir).filter((f) => f.endsWith('.ts'))

let updatedFiles = 0
let updatedValues = 0

for (const f of files) {
  if (f === 'en-US.ts') continue

  const overrides = overridesByLocaleFile[f]
  if (!overrides) continue

  const full = path.join(localesDir, f)
  const localeObj = loadLocale(full)

  let changed = false

  for (const [keyPath, translated] of Object.entries(overrides)) {
    const baseVal = getPath(baseObj, keyPath)
    const curVal = getPath(localeObj, keyPath)

    // Only overwrite if missing or still equals en-US value.
    if (curVal === undefined || (baseVal !== undefined && curVal === baseVal)) {
      setPath(localeObj, keyPath, translated)
      changed = true
      updatedValues++
    }
  }

  if (!changed) continue

  const out = `export default ${formatObject(localeObj, 0)}\n`
  fs.writeFileSync(full, out, 'utf8')
  updatedFiles++
}

console.log(`Updated ${updatedValues} value(s) across ${updatedFiles} file(s).`)
