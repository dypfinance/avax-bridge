import React from 'react'
import getFormattedNumber from '../functions/get-formatted-number'
import Countdown from 'react-countdown'


// Renderer callback with condition
const getRenderer = (completedText='0s', braces=false) => ({ days, hours, minutes, seconds, completed }) => {
    if (braces && completedText == '0s') {
      completedText='( 0s )'
    }
    if (completed) {
      // Render a complete state
      return <span>{completedText}</span>;
    } else {
      // Render a countdown
      return (
        <span>
          {braces?'(':''} {days > 0 ? days+'d ' :''}{hours > 0 || days > 0 ? hours+'h ' :''}{minutes > 0 || hours > 0 || days > 0 ? minutes+'m ':''}{seconds}s {braces?')':''}
          {/* {days}d {hours}h {minutes}m {seconds}s Left */}
        </span>
      );
    }
  };

export default function initVault({ bridgeETH, bridgeBSC, tokenETH, tokenBSC, TOKEN_DECIMALS=18, TOKEN_SYMBOL='DYP' }) {

    let { BigNumber } = window


    class Bridge extends React.Component {
        constructor(props) {
            super(props)
            this.state = {
                token_balance: '',
                network: 'ETH',
                depositAmount: '',
                coinbase: '',
                gasPrice: '',
                txHash: '',
                withdrawableUnixTimestamp: null
            }
        }

        
        componentDidMount() {
            this.refreshBalance()
            window._refreshBalInterval = setInterval(this.refreshBalance, 4000)

            fetch('https://data-api.defipulse.com/api/v1/egs/api/ethgasAPI.json?api-key=f9b308da480b2941d3f23b9e0366c141f8998f75803a5ee65f51cbcb261f')
                .then(res => res.json())
                .then(data => this.setState({gasPrice: data.fast/10}))
                .catch(console.error)
        }

        componentWillUnmount() {
            clearInterval(window._refreshBalInterval)
        }

        handleApprove = (e) => {
            e.preventDefault()
            let amount = this.state.depositAmount
            amount = new BigNumber(amount).times(10**TOKEN_DECIMALS).toFixed(0)
            let bridge = this.state.network == 'ETH' ? bridgeETH : bridgeBSC;
            (this.state.network == 'ETH' ? tokenETH : tokenBSC).approve(bridge._address, amount)
        }
       
        handleDeposit = async (e) => {
            let amount = this.state.depositAmount
            amount = new BigNumber(amount).times(10**TOKEN_DECIMALS).toFixed(0)
            let bridge = this.state.network == 'ETH' ? bridgeETH : bridgeBSC

            let contract = await window.getBridgeContract(bridge._address)
            contract.methods.deposit(amount).send({from: await window.getCoinbase()}, (err, txHash) => {
                this.setState({txHash})
            })
        }

        handleWithdraw = async (e) => {
            e.preventDefault()
            let amount = this.state.withdrawAmount
            amount = new BigNumber(amount).times(10**TOKEN_DECIMALS).toFixed(0)
            try {
                let url = window.config.SIGNATURE_API_URL+`/api/withdraw-args?depositNetwork=${this.state.network == 'ETH' ? 'AVAX': "ETH"}&txHash=${this.state.txHash}`
                console.log({url})
                let args = await window.jQuery.get(url);
                console.log({args});
                (this.state.network == 'ETH' ? bridgeETH : bridgeBSC).withdraw(args)
            } catch (e) {
                window.alertify.error("Something went wrong!")
                console.error(e)
            }
        }

        handleSetMaxDeposit = (e) => {
            e.preventDefault()
            this.setState({ depositAmount: new BigNumber(this.state.token_balance).div(10**TOKEN_DECIMALS).toFixed(TOKEN_DECIMALS) })
        }

        refreshBalance = async () => {
            let coinbase = await window.getCoinbase()
            this.setState({ coinbase })
            try {
                let chainId = await window.web3.eth.getChainId()
                let network = window.config.chain_ids[chainId] || 'UNKNOWN'

                let token_balance = await (network == 'AVAX' ? tokenBSC : tokenETH).balanceOf(coinbase)


                this.setState({
                    token_balance,
                    network
                })

                if (this.state.txHash) {
                    try {
                        let url = window.config.SIGNATURE_API_URL+`/api/withdraw-args?depositNetwork=${this.state.network == 'ETH' ? 'AVAX': "ETH"}&txHash=${this.state.txHash}&getWithdrawableUnixTimestamp=true`
                        console.log({url})
                        let { withdrawableUnixTimestamp } = await window.jQuery.get(url);
                        this.setState({ withdrawableUnixTimestamp })
                        console.log({withdrawableUnixTimestamp})
                    } catch (e) {
                        console.error(e)
                        this.setState({withdrawableUnixTimestamp: null})
                    }
                } else this.setState({withdrawableUnixTimestamp: null})

            } catch (e) {
                console.error(e)
            } 

            
        }


        render() {

            let canWithdraw = false
            let timeDiff = null

            if (this.state.withdrawableUnixTimestamp) {
                timeDiff = Math.max(0, this.state.withdrawableUnixTimestamp * 1e3  -  Date.now())
                canWithdraw = timeDiff === 0
            }

            return (<div>
                
                <div className='container'>
                    <div className='token-staking mt-5'>
                        <div className='row'>
                            <div className='col-lg-12' style={{maxWidth: '600px', margin: 'auto'}}>
                                <div className='row token-staking-form'>
                                    <div className='col-12'>
                                        <div className='l-box'>
                                        <form onSubmit={e => e.preventDefault()}>
                                            <div className='form-group'>
                                                <div className='row'>
                                                    <div className='col-12'>
                                                        <label htmlFor='deposit-amount' className='d-block text-left'>DEPOSIT ({this.state.network} network)</label>
                                                        <p>Balance: {getFormattedNumber(this.state.token_balance/1e18, 6)} DYP</p>
                                                    </div>
                                                </div>
                                                <div className='input-group '>
                                                    <input value={Number(this.state.depositAmount) > 0 ? this.state.depositAmount  : this.state.depositAmount} onChange={e => this.setState({ depositAmount: e.target.value })} className='form-control left-radius' placeholder='0' type='text' />
                                                    <div className='input-group-append'>
                                                        <button className='btn  btn-primary right-radius btn-max l-light-btn' style={{ cursor: 'pointer' }} onClick={this.handleSetMaxDeposit}>
                                                            MAX
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className='row'>
                                                <div style={{ paddingRight: '0.3rem' }} className='col-6'>
                                                    <button onClick={this.handleApprove} className='btn  btn-block btn-primary ' type='button'>
                                                        APPROVE
                                            </button>
                                                </div>
                                                <div style={{ paddingLeft: '0.3rem' }} className='col-6'>
                                                    <button onClick={this.handleDeposit} className='btn  btn-block btn-primary l-outline-btn' type='submit'>
                                                        DEPOSIT
                                            </button>
                                                </div>
                                            </div>
                                            <p style={{ fontSize: '.8rem' }} className='mt-1 text-center mb-0 text-muted mt-3'>
                                                {/* Some info text here.<br /> */}
                                        Please approve before deposit.
                                    </p>

                                        </form>
                                        </div>
                                    </div>
                                    <div className='col-12'>
                                        <div className='l-box'>
                                        <form onSubmit={this.handleWithdraw} className="pb-0">
                                            <div className='form-group'>
                                                <label htmlFor='deposit-amount' className='d-block text-left'>WITHDRAW ({this.state.network} network)</label>
                                                <div className='input-group '>
                                                    <input value={this.state.txHash} onChange={e => this.setState({ txHash:e.target.value })} className='form-control left-radius' placeholder='Enter Deposit transaction hash' type='text' />
                                                    
                                                </div>
                                            </div>
                                            <button disabled={!canWithdraw} className='btn  btn-primary btn-block l-outline-btn' type='submit'>
                                                WITHDRAW {this.state.withdrawableUnixTimestamp && Date.now() < this.state.withdrawableUnixTimestamp*1e3  && 
                                        <span>&nbsp; <Countdown onComplete={() => this.forceUpdate()} key="withdrawable" date={this.state.withdrawableUnixTimestamp*1e3} renderer={getRenderer(undefined, true)} /></span> }
                                        </button>
                                            <p style={{fontSize: '.8rem'}} className='mt-1 text-muted mt-3'>After Successful Deposit, Switch MetaMask to {this.state.network == 'ETH' ? 'AVAX' : 'ETH'} network if you deposited on {this.state.network} network!</p>
                                            <p className='mt-1 text-muted mt-3' style={{fontSize: '.8rem'}}> Please note that the maximum amount that you can swap per wallet every 24 hours is maximum 50,000 DYP tokens.</p>
                                            <p className='mt-1 text-muted mt-3' style={{fontSize: '.8rem'}}>We recommend on saving the transaction hash, in case you have network issues you will be able to withdraw later.</p>
                                        </form>
                                        </div>
                                    </div>
                                    </div>
                                    
                                    
                            
                            </div>
                            
                        </div>


                        {/* <div className='mt-3 text-center'>
                    <p><small>Some info text here</small></p>
                </div> */}
                    </div>
                </div>
            </div>
            )
        }
    }


    return Bridge
}
