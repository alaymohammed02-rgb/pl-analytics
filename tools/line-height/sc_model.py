import numpy as np,collections
from sklearn.ensemble import HistGradientBoostingRegressor
R=np.load('sc_rows.npy');mid,team,phin=R[:,0],R[:,1],R[:,2];X=R[:,3:-1];y=R[:,-1]
pred=np.zeros_like(y)
for m in np.unique(mid):
    tr,te=mid!=m,mid==m
    g=HistGradientBoostingRegressor(max_iter=300,learning_rate=.06,max_leaf_nodes=31,min_samples_leaf=60,l2_regularization=1.0,random_state=0).fit(X[tr],y[tr])
    pred[te]=g.predict(X[te])
base=X[:,0]
print('frame level (leave one match out):  baseline deepest-visible MAE %.2f bias %+.2f | model MAE %.2f bias %+.2f'%(np.mean(abs(base-y)),np.mean(base-y),np.mean(abs(pred-y)),np.mean(pred-y)))
# team-match averages, as the site would show them
E=collections.defaultdict(lambda:[[],[],[]])
for i in range(len(y)):E[(mid[i],team[i],phin[i])][0].append(y[i]);E[(mid[i],team[i],phin[i])][1].append(pred[i]);E[(mid[i],team[i],phin[i])][2].append(base[i])
eb=[];em=[]
for k,(t,p,b) in E.items():eb.append(np.mean(b)-np.mean(t));em.append(np.mean(p)-np.mean(t))
eb,em=np.array(eb),np.array(em)
print('team-match averages (%d): baseline mean err %+.2f, MAE %.2f, max %.2f | model mean err %+.2f, MAE %.2f, max %.2f'%(len(em),eb.mean(),abs(eb).mean(),abs(eb).max(),em.mean(),abs(em).mean(),abs(em).max()))
for ph in (1,0):
    s=[(np.mean(t),np.mean(p)) for k,(t,p,b) in E.items() if k[2]==ph]
    t,p=np.array(s).T;print(' %s: corr true vs model %.2f, MAE %.2f'%('with ball' if ph else 'without',np.corrcoef(t,p)[0,1],np.mean(abs(t-p))))
