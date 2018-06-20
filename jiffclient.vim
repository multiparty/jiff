let SessionLoad = 1
let s:so_save = &so | let s:siso_save = &siso | set so=0 siso=0
let v:this_session=expand("<sfile>:p")
silent only
cd ~/SAIL/jiff
if expand('%') == '' && !&modified && line('$') <= 1 && getline(1) == ''
  let s:wipebuf = bufnr('%')
endif
set shortmess=aoO
badd +0 lib/jiff-client.js
badd +0 demos/BGW-triples/mpc.js
argglobal
silent! argdel *
$argadd lib/jiff-client.js
edit lib/jiff-client.js
set splitbelow splitright
wincmd _ | wincmd |
vsplit
1wincmd h
wincmd _ | wincmd |
split
1wincmd k
wincmd w
wincmd w
wincmd t
set winminheight=1 winminwidth=1 winheight=1 winwidth=1
exe '1resize ' . ((&lines * 24 + 26) / 52)
exe 'vert 1resize ' . ((&columns * 122 + 95) / 191)
exe '2resize ' . ((&lines * 25 + 26) / 52)
exe 'vert 2resize ' . ((&columns * 122 + 95) / 191)
exe 'vert 3resize ' . ((&columns * 68 + 95) / 191)
argglobal
setlocal fdm=manual
setlocal fde=0
setlocal fmr={{{,}}}
setlocal fdi=#
setlocal fdl=0
setlocal fml=1
setlocal fdn=20
setlocal fen
silent! normal! zE
let s:l = 518 - ((23 * winheight(0) + 12) / 24)
if s:l < 1 | let s:l = 1 | endif
exe s:l
normal! zt
518
normal! 05|
wincmd w
argglobal
if bufexists('lib/jiff-client.js') | buffer lib/jiff-client.js | else | edit lib/jiff-client.js | endif
setlocal fdm=manual
setlocal fde=0
setlocal fmr={{{,}}}
setlocal fdi=#
setlocal fdl=0
setlocal fml=1
setlocal fdn=20
setlocal fen
silent! normal! zE
let s:l = 1421 - ((11 * winheight(0) + 12) / 25)
if s:l < 1 | let s:l = 1 | endif
exe s:l
normal! zt
1421
normal! 043|
wincmd w
argglobal
if bufexists('demos/BGW-triples/mpc.js') | buffer demos/BGW-triples/mpc.js | else | edit demos/BGW-triples/mpc.js | endif
setlocal fdm=manual
setlocal fde=0
setlocal fmr={{{,}}}
setlocal fdi=#
setlocal fdl=0
setlocal fml=1
setlocal fdn=20
setlocal fen
silent! normal! zE
let s:l = 24 - ((8 * winheight(0) + 25) / 50)
if s:l < 1 | let s:l = 1 | endif
exe s:l
normal! zt
24
normal! 0
wincmd w
2wincmd w
exe '1resize ' . ((&lines * 24 + 26) / 52)
exe 'vert 1resize ' . ((&columns * 122 + 95) / 191)
exe '2resize ' . ((&lines * 25 + 26) / 52)
exe 'vert 2resize ' . ((&columns * 122 + 95) / 191)
exe 'vert 3resize ' . ((&columns * 68 + 95) / 191)
tabnext 1
if exists('s:wipebuf') && getbufvar(s:wipebuf, '&buftype') isnot# 'terminal'
  silent exe 'bwipe ' . s:wipebuf
endif
unlet! s:wipebuf
set winheight=1 winwidth=20 winminheight=1 winminwidth=1 shortmess=filnxtToO
let s:sx = expand("<sfile>:p:r")."x.vim"
if file_readable(s:sx)
  exe "source " . fnameescape(s:sx)
endif
let &so = s:so_save | let &siso = s:siso_save
doautoall SessionLoadPost
unlet SessionLoad
" vim: set ft=vim :
