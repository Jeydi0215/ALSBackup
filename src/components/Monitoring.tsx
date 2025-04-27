import { useState } from 'react'

import styles from '../css/Monitoring.module.css'
import EmployeeTracker from './EmployeeTracker'
import Pending from './Pending'
import Logged from '../assets/logged.png'
import Search from '../assets/search.png'
import Clock from '../assets/clock.png'
import Coffee from '../assets/coffee.png'
import Out from '../assets/logout.png'

const Monitoring = () => {
    const [activeButton, setActiveButton] = useState('tracker'); 
    const [TableShow, setTableShow] = useState(false)
    const handleTableClick = (buttonName) => {
        setTableShow( !TableShow )
        setActiveButton(buttonName);
    }
    


    return(
        <div className={styles.Monitoring}>
            <span className={styles.Monitoring_title}>Employee Monitoring</span>
            <div className={styles.Widget_container}>
                <div className={styles.Widget}>
                    <div className={styles.Widget_inner}>
                        <span>Logged In</span>
                        <img src={Logged} alt="User icon" />
                    </div>
                    <span className={styles.Count}>21/50</span>
                </div>

                <div className={styles.Widget}>
                    <div className={styles.Widget_inner}>
                        <span>Working</span>
                        <img src={Clock} alt="User icon" />
                    </div>
                    <span className={styles.Count}>21/50</span>
                </div>

                <div className={styles.Widget}>
                    <div className={styles.Widget_inner}>
                        <span>On Break</span>
                        <img src={Coffee} alt="User icon" />
                    </div>
                    <span className={styles.Count}>21/50</span>
                </div>

                <div className={styles.Widget}>
                    <div className={styles.Widget_inner}>
                        <span>Clock Out</span>
                        <img src={Out} alt="User icon" />
                    </div>
                    <span className={styles.Count}>21/50</span>
                </div>
            </div>

            <div className={styles.Monitoring_table}>
                <div className={styles.Monitoring_inner}>
                    <div className={styles.Monitoring_left}>
                        <button
                            className={activeButton === 'tracker' ? styles.Active : ''}
                            onClick={() => handleTableClick('tracker')}
                        >
                            Tracker
                        </button>
                        <button
                            className={activeButton === 'approval' ? styles.Active : ''}
                            onClick={() => handleTableClick('approval')}
                        >
                            Approval
                        </button>
                    </div>

                    <div className={styles.Monitoring_right}>
                        <div className={styles.Right_inner}>
                            <input type="text" placeholder='Search...'/>
                            <img src={Search} alt="Search icon" />
                        </div>
                        <select name="" id="">
                            <option value="">All</option>
                        </select>
                    </div>
                </div>
                {
                    TableShow ?<Pending /> : <EmployeeTracker/>
                }
                
                


            </div>
        </div>
    )
}


export default Monitoring;