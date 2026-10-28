import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
root=Path(__file__).resolve().parent.parent
r=json.loads((root/'docs/mo4-numerical-results.json').read_text())
fig,axes=plt.subplots(3,1,figsize=(9,8),sharex=True)
for c,color in zip(r['infection']['curves'],['#377eb8','#e0842b','#a23c4b']):
 rows=c['rows'];t=[x['time']/60 for x in rows]
 for ax,key in zip(axes,['level','staminaFactor','recoveryFactor']):ax.plot(t,[x[key] for x in rows],color=color,label=f"s={c['severity']:.1f}, onset {c['latencyS']/60:.2f} min")
for ax,title in zip(axes,['Infection level','Leg stamina maximum and absolute recovery factor','Part HP recovery factor']):
 ax.set_title(title,loc='left',fontsize=11);ax.grid(alpha=.2);ax.set_ylim(0,1.05);ax.set_yticks([0,.25,.5,.75,1]);ax.legend(fontsize=8,loc='best')
axes[-1].set_xlabel('Time since injury (minutes)');fig.suptitle('MO4 game infection model - synthetic upstream organ input',fontsize=12);fig.tight_layout()
out=root/'docs/media/mo4';out.mkdir(parents=True,exist_ok=True);fig.savefig(out/'infection-curves.svg');plt.close(fig)
