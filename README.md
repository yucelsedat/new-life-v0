# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

---

# graphify — Kod Tabanı Bilgi Grafı (Türkçe)

`graphify`, projedeki dosyaları tarayıp aralarındaki ilişkileri bir **bilgi grafına** çevirir. Claude, kod tabanıyla ilgili sorulara cevap verirken dosyaları tek tek taramak yerine bu grafa bakar — böylece hem daha hızlı hem de mimariyi bütün olarak görerek cevap verir.

Ürettiği üç çıktı `graphify-out/` klasörüne yazılır:

| Dosya | Ne işe yarar |
|---|---|
| `graph.json` | Ham graf verisi — sorgular bunu kullanır |
| `GRAPH_REPORT.md` | İnsan ve Claude için okunabilir rapor (god node'lar, topluluklar, sürpriz bağlantılar) |
| `graph.html` | Tarayıcıda açılan interaktif graf görselleştirmesi |

> **Not:** `graphify-out/` ve `CLAUDE.md` `.gitignore`'dadır. Bunlar üretilen/yerel dosyalardır; repoyu klonlayan her geliştirici kendi grafını üretir. Aşağıdaki adımlar tam olarak bunun içindir.

## 1. Kurulum

```bash
# CLI'ı kur (uv önerilir; pipx veya pip de olur)
uv tool install graphifyy
#   alternatif: pipx install graphifyy   /   pip install graphifyy

# /graphify slash komutunu Claude Code'a tanıt
graphify install --platform claude
```

`graphify install`, skill dosyasını `~/.claude/skills/graphify/SKILL.md` konumuna kopyalar. Bu adım olmadan Claude Code içinde `/graphify` komutu çalışmaz.

Doğrulama:

```bash
graphify --help          # komut listesi gelmeli
ls ~/.claude/skills/graphify/SKILL.md
```

## 2. Claude'a verilecek prompt (temiz kurulum)

Claude Code'u proje kökünde açın ve aşağıdaki promptu **olduğu gibi** yapıştırın. Bu prompt, kurulum sırasında karşılaşılan bilinen tuzakları baştan kapatır:

```text
Bu projede graphify bilgi grafını sıfırdan kur ve Claude entegrasyonunu yap.
Sırayla şunları yap ve her adımı doğrula:

1. /graphify . çalıştırarak grafı oluştur.
   - Kod dosyaları için AST çıkarımı + semantik çıkarım (subagent) birlikte çalışsın.
   - Bitince graph.json, GRAPH_REPORT.md ve graph.html'in ÜÇÜNÜN de aynı düğüm
     sayısını gösterdiğini doğrula. Tutmuyorsa raporu ve HTML'i doğru graftan
     yeniden üret.

2. graphify claude install çalıştır (CLAUDE.md + PreToolUse hook kurar).

3. Kurduktan sonra CLAUDE.md'yi aç ve şu satırı DÜZELT:
   graphify claude install, "kod değişince `graphify update .` çalıştır" diye
   yazıyor. Bu komut grafı yalnızca AST'den sıfırdan kurar; LLM ile çıkarılan
   tüm semantik düğümleri, görsel düğümlerini ve hyperedge'leri siler ve
   GRAPH_REPORT.md ile graph.html'i sessizce bozuk sürümle ezer.
   O satırı "güncelleme için /graphify . --update kullan" ile değiştir ve
   çıplak `graphify update .` komutunun kullanılmaması gerektiğini not düş.

3b. CLAUDE.md'ye "her merge sonrası grafı tazele" kuralını ekle:
   - main'e merge indikten hemen sonra, sorulmadan /graphify . --update çalıştır
     (feature branch'ten değil, main'den).
   - --update yalnızca SİLİNEN dosyaların düğümlerini temizler; DEĞİŞEN
     dosyalar için yeni çıkarım otoriter kabul edilip o dosyalara ait eski
     düğümler düşürülmeli, yoksa silinmiş fonksiyonlar hayalet düğüm olarak kalır.
   - Graf meşru şekilde küçüldüğünde to_json overwrite'ı reddeder; küçülmenin
     sebebi doğrulandıysa force=True ile geçilmeli.
   - graph.json'da küçülme koruması var ama GRAPH_REPORT.md ve graph.html'de yok;
     bitirmeden önce üçünün de aynı düğüm sayısını verdiği doğrulanmalı.

4. Kurulumun gerçekten çalıştığını kanıtla: graphify explain "<projede gerçekten
   var olan bir tip/fonksiyon>" ve graphify path "<A>" "<B>" komutlarını çalıştır,
   çıktının güncel koda karşılık geldiğini göster.

5. graphify-out/ ve CLAUDE.md'nin .gitignore'da olduğunu doğrula; değilse ekle.
```

## 3. Günlük kullanım

**Grafı güncelleme** — kodda değişiklik yaptıktan sonra, Claude Code içinde:

```text
/graphify . --update
```

Sadece değişen dosyaları yeniden işler ve mevcut grafla birleştirir.

> ⚠️ **Terminalden çıplak `graphify update .` çalıştırmayın.** Bu komut grafı yalnızca AST'den yeniden kurar; semantik düğümleri, görsel düğümlerini ve hyperedge'leri atar (bu projede 199 → 136 düğüm) ve raporu/HTML'i bozuk sürümle ezer. `graph.json` bir koruma sayesinde kurtulur ama `GRAPH_REPORT.md` ve `graph.html` bozulur.

> ⚠️ **Incremental güncellemenin bilinen sınırı:** `--update` yalnızca *silinen* dosyaların düğümlerini temizler. *Değişen* bir dosyadan bir fonksiyon/sabit sildiyseniz eski düğüm grafta kalmaya devam eder. Emin olmak için Claude'a "yeniden çıkarılan dosyalar için yeni çıkarımı otoriter kabul et, o dosyalara ait eski düğümleri düş" diyebilir veya grafı sıfırdan kurabilirsiniz.

**Sorgulama** (terminalden veya Claude üzerinden):

```bash
graphify query "sahne varyantları oyun sırasında nasıl döngüye giriyor"
graphify path "Game Page" "SQLite Database Handle"
graphify explain "useWorldCanvas"
```

**Görselleştirme:** `graphify-out/graph.html` dosyasını tarayıcıda açın — sunucu gerekmez.

## 4. Entegrasyon ne yapıyor?

`graphify claude install` iki şey kurar:

- **`CLAUDE.md`** — Claude'a "mimari sorularında önce `GRAPH_REPORT.md`'yi oku, cross-module sorularda grep yerine `graphify query/path/explain` kullan" talimatını verir.
- **`.claude/settings.json` içine bir `PreToolUse` hook'u** — Glob/Grep kullanıldığında "önce grafa bak" hatırlatmasını bağlama enjekte eder. Salt okunur ve zararsızdır; hiçbir dosyaya yazmaz.

Kaldırmak için: `graphify claude uninstall`
