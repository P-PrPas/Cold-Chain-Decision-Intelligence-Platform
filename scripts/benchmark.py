"""Synthetic in-process benchmark; does not claim queue/storage/database import throughput."""
import json
import platform
import sys
import time
from datetime import UTC,datetime,timedelta
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'services/api'))
from app.temperature import normalize
from app.analytics import Rules,analyze
from app.simulation_engine import ScenarioInput,Weights,calculate
start=datetime(2026,1,1,tzinfo=UTC)
content=('timestamp,temperature_c,sensor_id\n'+'\n'.join(f'{(start+timedelta(seconds=i*60)).isoformat()},4,A' for i in range(100000))).encode()
tick=time.perf_counter();rows,validation=normalize(content,{'timestamp':'timestamp','temperature':'temperature_c','sensor_id':'sensor_id'},None,'C');normalization=time.perf_counter()-tick
rules=Rules(required_sensor_ids=['A'],max_valid_sampling_gap_seconds=600,temperature_bounds={'min_c':'2','max_c':'8'},continuous_excursion_limit_seconds=300,cumulative_excursion_limit_seconds=600)
tick=time.perf_counter();result=analyze(rows,rules,rows[0]['timestamp_utc'],rows[-1]['timestamp_utc']);analysis=time.perf_counter()-tick
scenario=ScenarioInput(type='HOLD_INSPECTION',estimated_delay_minutes=60,receiver_acceptance='UNKNOWN',costs={name:{'amount':'1.00','source':'USER_ESTIMATE'} for name in ['additional_transport','inspection','holding','handling','disposal','other']})
tick=time.perf_counter();calculate(result,rules,[scenario],Weights(cost='0.60',delay='0.40'),'THB');simulation=time.perf_counter()-tick
assert len(rows)==100000 and not validation['errors'] and result['classification']=='NORMAL'
report={'environment':platform.platform(),'python':platform.python_version(),'rows':len(rows),'input_bytes':len(content),'concurrency':1,'normalization_seconds':normalization,'analysis_seconds':analysis,'simulation_seconds':simulation,'scope':'In-process synthetic parsing/analysis/calculation; excludes persistence, queue and network.'}
print(json.dumps(report,indent=2))
if '--output' in sys.argv:Path(sys.argv[sys.argv.index('--output')+1]).write_text(json.dumps(report,indent=2)+'\n')
