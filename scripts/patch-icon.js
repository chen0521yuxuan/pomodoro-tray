// 给 electron.exe 替换图标资源（番茄图标）
const fs = require('fs')
const ResEdit = require('resedit')

const exePath = process.argv[2]
const icoPath = process.argv[3]

const input = fs.readFileSync(exePath)
const exe = ResEdit.NtExecutable.from(input)
const res = ResEdit.NtExecutableResource.from(exe)
const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(icoPath))

const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries)
console.log('icon groups found:', JSON.stringify(groups.map((g) => ({ id: g.id, lang: g.lang }))))
if (groups.length === 0) throw new Error('no icon group in exe')
const target = groups[0]
console.log('patching group id=' + target.id + ' lang=' + target.lang)

ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
  res.entries,
  target.id,
  target.lang,
  iconFile.icons.map((item) => item.data)
)
res.outputResource(exe)
const output = Buffer.from(exe.generate({ ignoreCert: true }))
fs.writeFileSync(exePath, output)
console.log('icon patched OK, new size: ' + output.length)
