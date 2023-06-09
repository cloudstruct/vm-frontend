import CheckRewardInput from "src/components/Claim/CheckRewardInput";
import RewardsView from "src/components/Claim/RewardsView";
import useClaimReward from "src/hooks/cardano/claim/useClaimReward";
import { useQueue } from "src/hooks/cardano/claim/useQueue";

function Claim() {
  const {
    searchAddress,
    setSearchAddress,
    checkRewards,
    isCheckRewardLoading,
    isClaimRewardLoading,
    selectAll,
    cancelClaim,
    claimableTokens,
    handleTokenSelect,
    numberOfSelectedTokens,
    claimRewards,
    poolInfo,
    maxTokenSelected,
    selectRandomTokens,
  } = useClaimReward();
  const queue = useQueue();

  return (
    <>
      <p className="text-3xl flex items-center gap-2">Claim your rewards</p>
      <div className="flex flex-col gap-4">
        <CheckRewardInput
          searchAddress={searchAddress}
          setSearchAddress={setSearchAddress}
          checkRewards={checkRewards}
          isSearchDisabledAndStakingInfoShown={claimableTokens.length === 0}
          isRewardLoading={isCheckRewardLoading}
          cancelClaim={cancelClaim}
        />
        <RewardsView
          claimableTokens={claimableTokens}
          handleTokenSelect={handleTokenSelect}
          numberOfSelectedTokens={numberOfSelectedTokens}
          claimRewards={claimRewards}
          isLoadingClaimReward={isClaimRewardLoading}
          selectAll={selectAll}
          poolInfo={poolInfo}
          maxTokenSelected={maxTokenSelected}
          selectRandomTokens={selectRandomTokens}
        />
      </div>
    </>
  );
}

export default Claim;
