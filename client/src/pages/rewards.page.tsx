import { faXmark, faCopy } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState, KeyboardEvent } from 'react';
import { ClaimableToken, GetRewards } from '../entities/vm.entities';
import { getBlock, getRewards, getTokenTransactionHash, getTransactionStatus } from '../services/http.services';
import { copyContent, formatTokens, getNameFromHex, truncAmount } from '../services/utils.services';
import { HashLoader } from 'react-spinners';
import { PaymentStatus, TokenTransactionHashRequest } from '../entities/common.entities';
import WalletApi from '../services/connectors/wallet.connector';
import QRCode from 'react-qr-code';
import './rewards.page.scss';

interface Params {
    connectedWallet: WalletApi | undefined;
    showModal: (text: string) => void;
}

function Rewards({ connectedWallet, showModal }: Params) {
    const [hideCheck, setHideCheck] = useState(false);
    const [hideStakingInfo, setHideStakingInfo] = useState(true);
    const [hideSendAdaInfo, setHideSendAdaInfo] = useState(true);
    const [rewards, setRewards] = useState<GetRewards>();
    const [searchAddress, setSearchAddress] = useState<string>();
    const [loadingRewards, setLoadingRewards] = useState(false);
    const [checkedState, setCheckedState] = useState(new Array<boolean>());
    const [checkedCount, setCheckedCount] = useState(0);
    const [adaToSend, setAdaToSend] = useState(0);
    const [aproxReturn, setAproxReturn] = useState(0);
    const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(PaymentStatus.Awaiting);
    const [showTooltip, setShowTooltip] = useState(false);
    const [sendAdaSpinner, setSendAdaSpinner] = useState(false);
    const [paymentTxAfterBlock, setPaymentTxAfterBlock] = useState<number>();
    const [tokenTxAfterBlock, setTokenTxAfterBlock] = useState<number>();

    let searchForPaymentTxInterval: any;
    let searchForTokenTxInterval: any;
    let checkTokenInterval: any;
    let checkTransactionInterval: any;

    const handleOnChange = (position: number) => {
        const updatedCheckedState = checkedState.map((item, index) =>
            index === position ? !item : item
        );

        setCheckedState(updatedCheckedState);
        const updatedCheckedCount = updatedCheckedState.filter(check => check).length;
        setCheckedCount(updatedCheckedCount);
    };

    // TEST ADDRESS = stake_test1up7pxv6u7lf67v6kg08qkzdf6xjtazw7qkz9fae9m3vjyec3nk6yc
    const checkRewards = async () => {
        if (searchAddress) {
            setLoadingRewards(true);
            try {
                const rewards = await getRewards(searchAddress);

                if (rewards && Object.keys(rewards.consolidated_promises).length) {
                    setRewards(rewards);
                    setLoadingRewards(false);
                } else {
                    showModal('No rewards found for the account.');
                    setLoadingRewards(false);
                }
            } catch (ex: any) {
                if (ex?.response?.status === 404) {
                    showModal('Account not found.');
                    setLoadingRewards(false);
                }
            }
        }
    }

    const claimRewardsChecked = async () => {
        if (checkedCount > 0) {
            let tokens: ClaimableToken[] = [];
            checkedState.forEach((check, i) => {
                if (check && rewards?.claimable_tokens[i]) {
                    tokens.push(rewards.claimable_tokens[i]);
                }
            });
            claimRewards(tokens);
        }
    }

    const backRewards = async () => {
        setRewards(undefined);
        setSearchAddress('');
    }

    const sendADA = async () => {
        // TODO: Check that searched stake address === connected wallet stake address
        if (rewards) {
            setSendAdaSpinner(true);
            const txHash = await connectedWallet?.transferAda(rewards.vending_address, adaToSend.toString());
            if (txHash) {
                if (isTxHash(txHash)) {
                    const blockNumber = await getBlock();
                    setTokenTxAfterBlock(blockNumber);
                    showModal('https://testnet.cardanoscan.io/transaction/' + txHash);
                    setPaymentStatus(PaymentStatus.AwaitingConfirmations);
                    checkTransaction(txHash, true);
                    findTokenTxHash();
                } else {
                    showModal(txHash);
                }
            }
            setSendAdaSpinner(false);
        }
    }

    const findTokenTxHash = () => {
        checkTokenInterval = setInterval(async () => {
            if (searchAddress) {
                let tokens: ClaimableToken[] = [];
                checkedState.forEach((check, i) => {
                    if (check && rewards?.claimable_tokens[i]) {
                        tokens.push(rewards.claimable_tokens[i]);
                    }
                });
                const request: TokenTransactionHashRequest = {
                    address: searchAddress,
                    afterBlock: tokenTxAfterBlock || 0,
                    tokens: tokens.map(token => ({policyId: token.assetId.split('.')[0], quantity: token.amount.toString()}))
                }
                const response = await getTokenTransactionHash(request);
                if (response && response.txHash) {
                    setPaymentStatus(PaymentStatus.Completed);
                    clearInterval(checkTokenInterval);
                }
            }
        }, 15000);
    }

    const isTxHash = (txHash: string) => {
        return txHash.length === 64 && txHash.indexOf(' ') === -1;
    }

    const claimRewards = (tokens: ClaimableToken[]) => {
        if (rewards) {
            const tokenValue = 300000;
            const updatedAdaToSend = rewards.min_balance + tokenValue + tokens.length * tokenValue;
            const falseArray = new Array(checkedState.length).fill(false);
            const updatedAproxReturn = updatedAdaToSend - 168000 - 200000 * tokens.length;
            tokens.forEach((t: any, i) => falseArray[i] = true);
            setCheckedState(falseArray);
            setCheckedCount(tokens.length);
            setAdaToSend(updatedAdaToSend);
            setAproxReturn(updatedAproxReturn);
            setHideCheck(true);
            setHideStakingInfo(true)
            setHideSendAdaInfo(false);
        }
    }

    const renderStakeInfo = () => {
        if (rewards?.pool_info) {
            return (<>
                {rewards?.pool_info?.delegated_pool_logo ? <img className='pool-logo' src={rewards?.pool_info?.delegated_pool_logo} alt='' /> : ''}
                <div className='pool-info'>
                    <div className='staking-info'>
                        Currently staking&nbsp;<b>{rewards?.pool_info?.total_balance} ADA</b>&nbsp;with&nbsp;
                        <b className='no-break'>
                            [{rewards?.pool_info?.delegated_pool_name}]&nbsp;
                            {rewards?.pool_info?.delegated_pool_description}
                        </b>
                        <b className='no-break-mobile'>
                            [{rewards?.pool_info?.delegated_pool_name}]
                        </b>
                    </div>
                </div>
            </>)
        } else {
            return (<>Unregisted</>);
        }
    }

    const renderPaymentStatus = () => {
        switch (paymentStatus) {
            case PaymentStatus.Awaiting:
                return (<p className='awaiting'>
                    Awaiting payment
                </p>);
            case PaymentStatus.AwaitingConfirmations:
                return (<p className='confirmations'>
                    Awaiting payment confirmations
                </p>);
            case PaymentStatus.Sent:
                return (<p className='confirmed'>
                    Payment confirmed, sending tokens
                </p>);
            case PaymentStatus.Completed:
                return (<p className='completed'>
                    Withdraw completed
                </p>);
        }
    }

    const triggerTooltip = () => {
        setShowTooltip(true);
        setTimeout(() => {
            setShowTooltip(false);
        }, 1000);
    }

    // const searchForPaymentTx = () => {
    //     searchForPaymentTxInterval.clearInterval();
    //     searchForPaymentTxInterval = setInterval(() => {
    //         if (searchAddress) {
    //             // fetchTx(searchAddress);
    //         }
    //     }, 5000);
    // }

    // const searchForTokenTx = () => {
    //     clearInterval(searchForPaymentTxInterval);
    //     searchForTokenTxInterval = setInterval(() => {
    //         if (searchAddress) {
    //             checkTx(searchAddress, false);
    //         }
    //     }, 5000);
    // }

    const checkTransaction = (txHash: string, isPayment: boolean) => {
        checkTransactionInterval = setInterval(async () => {
            if (searchAddress) {
                const transaction = await getTransactionStatus(txHash);
                if (transaction && transaction.length && transaction[0].num_confirmations) {
                    if (isPayment) {
                        setPaymentStatus(PaymentStatus.Sent);
                    } else {
                        setPaymentStatus(PaymentStatus.Completed);
                    }
                    clearInterval(checkTransactionInterval);
                }
            }
        }, 10000);
    }

    useEffect(() => {
        if (rewards?.claimable_tokens.length) {
            setCheckedState(new Array(rewards.claimable_tokens.length).fill(false));
            setHideStakingInfo(false);
        } else {
            setCheckedState([]);
            setHideStakingInfo(true);
        }
    }, [rewards?.claimable_tokens]);

    useEffect(() => {
        async function init() {
            if (connectedWallet?.wallet?.api) {
                setSearchAddress(await connectedWallet.getAddress());
                setHideCheck(false);
                setHideStakingInfo(true);
                setHideSendAdaInfo(true);
            } else {
                setPaymentStatus(PaymentStatus.Awaiting);
            }
        }

        init();
    }, [connectedWallet?.wallet?.api, connectedWallet]);

    function renderSendAdaButton() {
        if (connectedWallet?.wallet?.api) {
            return (
                <button className='tosi-button' onClick={sendADA}>
                    Send ADA
                    <HashLoader color='#73badd' loading={sendAdaSpinner} size={25} />
                </button>
            );
        } else {
            return null;
        }
    }

    function renderQRCode() {
        if (rewards?.vending_address) {
            return (
                <div className='qr-address'>
                    <QRCode value={rewards?.vending_address} size={180} />
                </div>
            );
        } else {
            return null;
        }
    }

    function renderCheckRewardsStep() {
        if (!hideCheck) {
            return (
                <div className='content-reward check'>
                    <p>Enter your wallet/stake address or $handle to view your rewards</p>
                    <input
                        className='transparent-input'
                        type="text"
                        value={searchAddress}
                        onInput={(e: KeyboardEvent<HTMLInputElement>) => setSearchAddress((e.target as HTMLInputElement).value)}
                        disabled={!hideStakingInfo || typeof connectedWallet?.wallet?.api !== 'undefined'}
                    ></input>
                    <div className='content-button'>
                        <button className='tosi-button' disabled={!hideStakingInfo} onClick={checkRewards}>
                            Check my rewards
                            <HashLoader color='#73badd' loading={loadingRewards} size={25} />
                        </button>
                        <button className={'tosi-cancel-button' + (hideStakingInfo ? ' hidden' : '')} onClick={backRewards}>
                            <div className='tosi-cancel-icon'><FontAwesomeIcon icon={faXmark} /></div>
                            <div className='tosi-cancel-text'>Cancel</div>
                        </button>
                    </div>
                </div>
            );
        } else {
            return null;
        }
    }

    function renderStatusStep() {
        if (!hideSendAdaInfo) {
            return (
                <div className='status-step'>
                    <div className='content-reward claim-status-head'>
                        Claim status: <div className='payment-status'>{renderPaymentStatus()}</div>
                    </div>
                    <div className='content-reward claim-status-body'>
                        <div className="icon-input">
                            <div className={'tooltip-icon' + (showTooltip ? '' : ' hidden')}>Address copied</div>
                            <div className='icon' onClick={() => {
                                copyContent(rewards ? rewards.vending_address : '');
                                triggerTooltip();
                            }}>
                                <FontAwesomeIcon icon={faCopy} />
                            </div>
                            <input className='transparent-input' type="text" disabled={true} value={rewards?.vending_address} />
                        </div>
                        {renderQRCode()}
                        <div className='complete-info'>Complete the withdrawal process by sending <b>{formatTokens(adaToSend.toString(), 6, 1)} ADA</b> to the above address</div>
                        {renderSendAdaButton()}
                        <div className='complete-send-info'><small>Please only send {formatTokens(adaToSend.toString(), 6, 1)} ADA. Any other amount will be considered an error and refunded in aproximately 72 hours</small></div>
                    </div>

                    <div className='content-reward tx-details-head'>
                        <div>Transaction Details</div>
                        <div></div>
                    </div>
                    <div className='content-reward tx-details-body'>
                        <div>Selected {checkedCount} tokens</div>
                        <div>{formatTokens(((checkedCount * 300000)).toString(), 6, 1)} ADA</div>
                    </div>
                    <div className='content-reward tx-details-body'>
                        <div>Withdraw Fees</div>
                        <div>{formatTokens(rewards?.withdrawal_fee, 6, 1)} ADA</div>
                    </div>
                    <div className='content-reward tx-details-body'>
                        <div>Base Deposit</div>
                        <div>{formatTokens(((rewards?.min_balance || 0) + 300000).toString(), 6, 1)} ADA</div>
                    </div>
                    <div className='content-reward tx-details-body small-body'>
                        <div>You Send</div>
                        <div>{formatTokens((adaToSend).toString(), 6, 1)} ADA</div>
                    </div>
                    <div className='content-reward tx-details-body small-body'>
                        <div>Tx Fees</div>
                        <div>~0.168053 ADA</div>
                    </div>
                    <div className='content-reward tx-details-body small-body-last'>
                        <div>Total transaction</div>
                        <div>~{formatTokens((adaToSend + 168053).toString(), 6, 3)} ADA</div>
                    </div>
                    <div className='content-reward tx-details-body'>
                        <div>You'll get back (Aprox)</div>
                        <div>~{formatTokens(aproxReturn.toString(), 6, 3)} ADA</div>
                    </div>
                    <div className='content-reward tx-details-footer'>
                        <div className="deposit-info">You will pay a deposit, we will discount the withdraw fees and the tx fees (variable depending amount and size of tokens). Usually it'll cost no more than 0.5 ADA</div>
                    </div>
                </div>
            );
        } else {
            return null;
        }
    }

    function renderStakingInfoStep() {
        if (!hideStakingInfo) {
            return (
                <div className='staking-info'>
                    <div className={'content-reward staked'}>
                        {renderStakeInfo()}
                    </div>

                    <div className={'claim-list'}>
                        {
                            rewards?.claimable_tokens?.map((token, index) => {
                                return <div className='claim-item' key={index}>
                                    <div className='selection'>
                                        <label className='noselect'>
                                            <input
                                                type="checkbox"
                                                id={`custom-checkbox-${index}`}
                                                name={token.ticker}
                                                value={token.ticker}
                                                checked={checkedState[index]}
                                                onChange={() => handleOnChange(index)}
                                            />
                                            {truncAmount(token.amount, token.decimals)} available
                                        </label>
                                    </div>
                                    <div className='token-drop'>
                                        <div className='token-info'>
                                            <img alt='' src={token.logo}></img>
                                            <div>{token.assetId.split('.').length > 1 ? getNameFromHex(token.assetId.split('.')[1]) : getNameFromHex(token.assetId.split('.')[0])}</div>
                                        </div>
                                        <button className='tosi-button' onClick={() => { return claimRewards([token]) }}>Claim token</button>
                                    </div>
                                </div>
                            })
                        }
                    </div>

                    <div className={'content-reward claim'}>
                        <div className='text'>Selected {checkedCount} token</div>
                        <button className='tosi-button' disabled={checkedCount === 0} onClick={claimRewardsChecked}>
                            <div className='down-arrow' ></div>
                            Claim my rewards
                        </button>
                    </div>
                </div>
            );
        } else {
            return null;
        }
    }

    return (
        <div className='rewards'>
            <h1>Claim your rewards</h1>

            {renderCheckRewardsStep()}
            {renderStakingInfoStep()}
            {renderStatusStep()}
        </div>
    );
}

export default Rewards;
