import time
import statistics
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from app.security import verify_password, hash_password

# Defined in backend/app/routers/auth.py:236
DUMMY_HASH = "$argon2id$v=19$m=65536,t=3,p=4$dummysalthere$dummyhashvaluethatislong"
REAL_HASH = hash_password("ValidUserPassword123!")

def run_benchmark(n: int = 30):
    dummy_times = []
    for _ in range(n):
        t0 = time.perf_counter()
        res = verify_password("AnyPassword123!", DUMMY_HASH)
        t1 = time.perf_counter()
        assert res is False
        dummy_times.append((t1 - t0) * 1000.0)

    real_times = []
    for _ in range(n):
        t0 = time.perf_counter()
        res = verify_password("WrongPassword123!", REAL_HASH)
        t1 = time.perf_counter()
        assert res is False
        real_times.append((t1 - t0) * 1000.0)

    print("=== TIMING BENCHMARK: DUMMY HASH vs REAL HASH VERIFICATION ===")
    print(f"Dummy Hash (from auth.py:236): {DUMMY_HASH}")
    print(f"Sample Real Hash: {REAL_HASH[:35]}...")
    print(f"\nDummy Hash (n={n}):")
    print(f"  Mean:   {statistics.mean(dummy_times):.4f} ms")
    print(f"  Median: {statistics.median(dummy_times):.4f} ms")
    print(f"  Min:    {min(dummy_times):.4f} ms")
    print(f"  Max:    {max(dummy_times):.4f} ms")

    print(f"\nReal Hash (n={n}):")
    print(f"  Mean:   {statistics.mean(real_times):.4f} ms")
    print(f"  Median: {statistics.median(real_times):.4f} ms")
    print(f"  Min:    {min(real_times):.4f} ms")
    print(f"  Max:    {max(real_times):.4f} ms")

    ratio = statistics.mean(real_times) / statistics.mean(dummy_times)
    print(f"\nTiming Ratio (Real Mean / Dummy Mean): {ratio:.1f}x")

if __name__ == "__main__":
    run_benchmark()
